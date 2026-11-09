'use client'

import { Activity, Play, Square, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ProcesadorCelularPanel } from '@/components/procesador-celular'
import { ErrorApi, api } from '@/lib/api'
import { useCuenta } from '@/lib/cuenta'
import { decidirModo, marcarQueProcesoAqui } from '@/lib/modo'
import { formatearDuracion, formatearVelocidad, resumenPorCarril } from '@/lib/resultados'
import type { EstadoCarril, EstadoCarriles, NadadorDelGrupo, ResultadosSesion, Sesion } from '@/lib/tipos'

/** Avisos en vivo del backend (SSE). Si no se puede usar, se vuelve a preguntar cada CADA_MS. */
const AVISOS = '/api/sesiones/eventos'
const CADA_MS = 2000

/** Lo que el entrenador eligió para cada carril libre: no usarlo, reservarlo sin nadador, o un nadador de su grupo. */
type Eleccion = 'no' | 'reservar' | string

/** Agrega lo nuevo sin repetir: si la IA reenvió un lote, llegan ids que ya estaban. */
function sumar(previos: ResultadosSesion, nuevos: ResultadosSesion): ResultadosSesion {
  const eventos = new Set(previos.eventos.map((e) => e.id))
  const tramos = new Set(previos.tramos.map((t) => t.id))
  return {
    eventos: [...previos.eventos, ...nuevos.eventos.filter((e) => !eventos.has(e.id))],
    tramos: [...previos.tramos, ...nuevos.tramos.filter((t) => !tramos.has(t.id))],
  }
}

const ESTILO_CARRIL: Record<EstadoCarril['estado'], string> = {
  libre: 'border-emerald-200 bg-emerald-50/60',
  mio: 'border-blue-300 bg-blue-50',
  grupo: 'border-sky-200 bg-sky-50/60',
  ocupado: 'border-slate-200 bg-slate-50 opacity-70',
}

/**
 * La sesión de quien mira. Puede haber varias sesiones a la vez, cada una en sus carriles:
 *   * el entrenador elige los carriles y, en cada uno, un nadador de su grupo o ninguno (reservado para quien llegue);
 *   * el nadador puede sumarse a la sesión de su entrenador o empezar su sesión libre, en un carril que esté libre.
 * El modo de procesamiento no se muestra: lo decide `decidirModo()`.
 */
export function SesionPanel({ titulo = 'Sesión de entrenamiento', vacia = 'No hay una sesión en curso.' }: { titulo?: string; vacia?: string } = {}) {
  const { usuario } = useCuenta()
  const esNadador = usuario?.rol === 'nadador'
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [resultados, setResultados] = useState<ResultadosSesion | null>(null)
  const [estado, setEstado] = useState<EstadoCarriles | null>(null)
  const [grupo, setGrupo] = useState<NadadorDelGrupo[]>([])
  const [eleccion, setEleccion] = useState<Record<number, Eleccion>>({})
  const [carrilElegido, setCarrilElegido] = useState<number | null>(null)
  const [cargado, setCargado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const sesionId = useRef<string | null>(null)
  sesionId.current = sesion?.id ?? null

  const actualizar = useCallback(async () => {
    try {
      const [activa, carriles] = await Promise.all([api.sesionActiva(), api.estadoCarriles()])
      setSesion(activa)
      setEstado(carriles)
      setResultados(activa ? await api.resultadosSesion(activa.id) : null)
      setProblema((p) => (p && p.startsWith('No se pudo') ? null : p))
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudo consultar la sesión.')
    } finally {
      setCargado(true)
    }
  }, [])

  // el grupo del entrenador, para elegir quién va en cada carril
  useEffect(() => {
    if (!usuario || esNadador) return
    api.grupo().then(setGrupo).catch(() => setGrupo([]))
  }, [usuario, esNadador])

  // Lo medido llega por avisos (SSE) apenas el backend lo guarda. "carriles" avisa que alguien tomó o soltó carriles.
  // Al conectarse o reconectarse se trae todo una vez, por si se perdió algo mientras no había conexión.
  useEffect(() => {
    void actualizar()
    let respaldo: number | null = null
    const preguntarCadaTanto = () => {
      if (respaldo === null) respaldo = window.setInterval(() => void actualizar(), CADA_MS)
    }
    if (typeof EventSource === 'undefined') {
      preguntarCadaTanto()
      return () => (respaldo === null ? undefined : window.clearInterval(respaldo))
    }
    const avisos = new EventSource(AVISOS)
    const leer = <T,>(e: Event) => JSON.parse((e as MessageEvent<string>).data) as T
    avisos.onopen = () => void actualizar()
    for (const tipo of ['sesion_iniciada', 'sesion_finalizada', 'carriles']) avisos.addEventListener(tipo, () => void actualizar())
    avisos.addEventListener('resultados', (e) => {
      const nuevo = leer<ResultadosSesion & { sesion_id: string }>(e)
      if (nuevo.sesion_id !== sesionId.current) return
      setResultados((previos) => sumar(previos ?? { eventos: [], tramos: [] }, nuevo))
    })
    avisos.onerror = () => {
      if (avisos.readyState === EventSource.CLOSED) preguntarCadaTanto()
    }
    return () => {
      avisos.close()
      if (respaldo !== null) window.clearInterval(respaldo)
    }
  }, [actualizar])

  useEffect(() => {
    if (!sesion) return
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [sesion])

  const carriles = estado?.carriles ?? []
  const sesionEntrenador = estado?.sesion_de_mi_entrenador ?? null
  const elegidos = useMemo(
    () => Object.entries(eleccion).filter(([, v]) => v !== 'no').map(([c, v]) => ({ carril: Number(c), nadador_id: v === 'reservar' ? null : v })),
    [eleccion],
  )
  const enUso = new Set(Object.values(eleccion).filter((v) => v !== 'no' && v !== 'reservar'))

  async function correr(accion: () => Promise<unknown>, mensaje: string) {
    setOcupado(true)
    setProblema(null)
    try {
      await accion()
      await actualizar()
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : mensaje)
      void actualizar()
    } finally {
      setOcupado(false)
    }
  }

  const iniciar = (lista: { carril: number; nadador_id?: string | null }[]) =>
    correr(async () => {
      const { modo_procesamiento } = await api.configuracion()
      const nueva = await api.iniciarSesion(decidirModo(modo_procesamiento), lista)
      // en modo celular, procesa el dispositivo que inicia la sesión
      marcarQueProcesoAqui(nueva.modo === 'celular' ? nueva.id : null)
      setEleccion({})
      setCarrilElegido(null)
    }, 'No se pudo iniciar la sesión.')

  const unirse = (carril: number) =>
    correr(async () => {
      await api.unirseASesion(sesionEntrenador!, carril)
      setCarrilElegido(null)
    }, 'No se pudo sumarte a la sesión.')

  const finalizar = () =>
    correr(async () => {
      await api.finalizarSesion(sesion!.id)
      marcarQueProcesoAqui(null)
    }, 'No se pudo finalizar la sesión.')

  const resumen = resultados ? resumenPorCarril(resultados) : []
  const sinCalibracion = problema?.includes('calibración activa') ?? false
  const esMia = !!sesion && sesion.iniciada_por_id === usuario?.id
  // un nadador ve solo su carril; quien inició la sesión, todos
  const misCarriles = sesion ? sesion.carriles.filter((c) => esMia || c.usuario_id === usuario?.id) : []
  const carrilSel = carriles.find((c) => c.carril === carrilElegido) ?? null
  const puedeUnirse = !!sesionEntrenador && !!carrilSel && (carrilSel.estado === 'libre' || (carrilSel.estado === 'grupo' && !carrilSel.con_nadador))
  const puedeLibre = !!carrilSel && carrilSel.estado === 'libre'

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="titulo-sesion">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className={`flex size-10 items-center justify-center rounded-xl ${sesion ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Activity className="size-5" />
          </span>
          <div>
            <h3 id="titulo-sesion" className="font-semibold">{titulo}</h3>
            <p className="text-sm text-slate-500">
              {!cargado
                ? 'Consultando…'
                : sesion
                  ? `${esMia ? 'En curso' : 'En la sesión de tu entrenador'} · ${formatearDuracion(ahora - Date.parse(sesion.inicio))}`
                  : vacia}
            </p>
          </div>
        </div>
        {cargado && sesion && esMia && (
          <button
            onClick={finalizar}
            disabled={ocupado}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-100 transition hover:bg-rose-600 disabled:opacity-60"
          >
            <Square className="size-4 fill-current" /> Finalizar sesión
          </button>
        )}
      </div>

      {problema && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {problema}
          {sinCalibracion && !esNadador && (
            <>
              {' '}
              <a href="/calibracion" className="font-semibold underline">Ir a calibrar</a>
            </>
          )}
        </p>
      )}

      {/* ---- sin sesión: elegir carriles ---- */}
      {cargado && !sesion && carriles.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-700">
            {esNadador ? 'Elegí un carril' : 'Elegí los carriles de la sesión y quién va en cada uno'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {carriles.map((c) => (
              <div key={c.carril} className={`rounded-xl border p-4 ${ESTILO_CARRIL[c.estado]} ${carrilElegido === c.carril ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Carril {c.carril}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {c.estado === 'libre' && 'Libre'}
                    {c.estado === 'ocupado' && 'En uso'}
                    {c.estado === 'grupo' && (c.con_nadador ? 'Tu grupo · ocupado' : 'Tu grupo · libre')}
                    {c.estado === 'mio' && 'Tuyo'}
                  </span>
                </div>
                {!esNadador && c.estado === 'libre' && (
                  <select
                    value={eleccion[c.carril] ?? 'no'}
                    onChange={(e) => {
                      const v = e.target.value
                      setEleccion((x) => ({ ...x, [c.carril]: v }))
                    }}
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                    aria-label={`Quién va en el carril ${c.carril}`}
                  >
                    <option value="no">No usar</option>
                    <option value="reservar">Reservar (sin nadador)</option>
                    {grupo.map((n) => (
                      <option key={n.id} value={n.id} disabled={enUso.has(n.id) && eleccion[c.carril] !== n.id}>
                        {n.nombre}
                      </option>
                    ))}
                  </select>
                )}
                {esNadador && (c.estado === 'libre' || (c.estado === 'grupo' && !c.con_nadador)) && (
                  <button
                    onClick={() => setCarrilElegido(c.carril)}
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {carrilElegido === c.carril ? 'Elegido' : 'Elegir'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {!esNadador && (
              <button
                onClick={() => iniciar(elegidos)}
                disabled={ocupado || elegidos.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="size-4 fill-current" /> Iniciar sesión{elegidos.length ? ` (${elegidos.length} ${elegidos.length === 1 ? 'carril' : 'carriles'})` : ''}
              </button>
            )}
            {esNadador && sesionEntrenador && (
              <button
                onClick={() => unirse(carrilElegido!)}
                disabled={ocupado || !puedeUnirse}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
              >
                <UserPlus className="size-4" /> Sumarme a la sesión de mi entrenador
              </button>
            )}
            {esNadador && (
              <button
                onClick={() => iniciar([{ carril: carrilElegido! }])}
                disabled={ocupado || !puedeLibre}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Play className="size-4" /> Empezar mi sesión libre
              </button>
            )}
          </div>
          {esNadador && carrilSel?.estado === 'grupo' && (
            <p className="mt-2 text-xs text-slate-500">Ese carril es de la sesión de tu entrenador: solo podés sumarte a ella.</p>
          )}
        </div>
      )}

      {/* ---- con sesión ---- */}
      {sesion?.modo === 'celular' && esMia && <ProcesadorCelularPanel key={sesion.id} sesion={sesion} />}

      {sesion && misCarriles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {misCarriles.map((c) => (
            <span key={c.carril} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Carril {c.carril} · {c.nadador ?? 'reservado'}
            </span>
          ))}
        </div>
      )}

      {sesion && (
        <div className="mt-5">
          {resumen.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Esperando datos. Aparecen cuando el sistema detecta a un nadador cruzando una marca.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Carril</th>
                    <th className="py-2 pr-4 font-semibold">Última marca</th>
                    <th className="py-2 pr-4 font-semibold">Última velocidad</th>
                    <th className="py-2 pr-4 font-semibold">Velocidad media</th>
                    <th className="py-2 pr-4 font-semibold">Tramos</th>
                    <th className="py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((c) => (
                    <tr key={c.carril} className="border-t border-slate-100">
                      <td className="py-3 pr-4 font-semibold">
                        Carril {c.carril}
                        <span className="block text-xs font-normal text-slate-400">{sesion.carriles.find((a) => a.carril === c.carril)?.nadador ?? ''}</span>
                      </td>
                      <td className="py-3 pr-4">{c.ultimoNodo_m === null ? '—' : `${c.ultimoNodo_m} m`}</td>
                      <td className="py-3 pr-4">{formatearVelocidad(c.ultimaVelocidad_ms)}</td>
                      <td className="py-3 pr-4">{formatearVelocidad(c.velocidadMedia_ms)}</td>
                      <td className="py-3 pr-4">
                        {c.tramos}
                        {c.inferidos > 0 && <span className="ml-1 text-xs text-amber-600" title="Incluyen algo que no se llegó a ver">({c.inferidos} estimados)</span>}
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.enDescanso ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                          {c.enDescanso ? 'Descansando' : 'Nadando'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
