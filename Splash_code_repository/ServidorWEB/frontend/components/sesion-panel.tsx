'use client'

import { Activity, Lock, Play, Square, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ProcesadorCelularPanel } from '@/components/procesador-celular'
import { ErrorApi, api } from '@/lib/api'
import { useCuenta } from '@/lib/cuenta'
import { decidirModo, marcarQueProcesoAqui } from '@/lib/modo'
import { formatearDuracion, formatearVelocidad, resumenPorCarril } from '@/lib/resultados'
import type { EstadoCarril, EstadoCarriles, Grupo, Nadador, ResultadosSesion, Sesion } from '@/lib/tipos'

/** Avisos en vivo del backend (SSE). Si no se puede usar, se vuelve a preguntar cada CADA_MS. */
const AVISOS = '/api/sesiones/eventos'
const CADA_MS = 2000

/** Lo que el entrenador eligió para cada carril libre: no usarlo, reservarlo sin nadador, o un nadador. */
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
 *   * el entrenador elige si la sesión es de uno de sus grupos o libre (abierta a cualquier nadador), los carriles y,
 *     en cada uno, un nadador (del grupo, o cualquiera si es libre) o ninguno (reservado para quien llegue después);
 *   * el nadador puede sumarse a una sesión de un entrenador (de uno de sus grupos, o libre) o empezar su sesión
 *     personal, en un carril que esté libre.
 * El modo de procesamiento no se muestra: lo decide `decidirModo()`.
 */
export function SesionPanel({ titulo = 'Sesión de entrenamiento', vacia = 'No hay una sesión en curso.' }: { titulo?: string; vacia?: string } = {}) {
  const { usuario } = useCuenta()
  const esNadador = usuario?.rol === 'nadador'
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [resultados, setResultados] = useState<ResultadosSesion | null>(null)
  const [estado, setEstado] = useState<EstadoCarriles | null>(null)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [todos, setTodos] = useState<Nadador[]>([])
  /** De qué grupo es la sesión que va a iniciar el entrenador ('' = libre: cualquier nadador). */
  const [grupoSesion, setGrupoSesion] = useState('')
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

  // los grupos del entrenador y todos los nadadores, para elegir quién va en cada carril
  useEffect(() => {
    if (!usuario || esNadador) return
    api.grupos().then(setGrupos).catch(() => setGrupos([]))
    api.todosLosNadadores().then(setTodos).catch(() => setTodos([]))
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
  const disponibles = estado?.sesiones_disponibles ?? []
  // quiénes se pueden poner en un carril: los del grupo elegido, o todos si la sesión es libre
  const candidatos = grupoSesion ? (grupos.find((g) => g.id === grupoSesion)?.nadadores ?? []) : todos
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
      const nueva = await api.iniciarSesion(decidirModo(modo_procesamiento), lista, grupoSesion || null)
      // en modo celular, procesa el dispositivo que inicia la sesión
      marcarQueProcesoAqui(nueva.modo === 'celular' ? nueva.id : null)
      setEleccion({})
      setCarrilElegido(null)
    }, 'No se pudo iniciar la sesión.')

  const unirse = (sesionId: string, carril: number) =>
    correr(async () => {
      await api.unirseASesion(sesionId, carril)
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
  // a qué sesiones me puedo sumar con el carril elegido: la dueña del carril, o (si el carril está libre) cualquiera disponible
  const paraSumarme = !carrilSel
    ? []
    : carrilSel.estado === 'grupo' && !carrilSel.con_nadador
      ? disponibles.filter((d) => d.id === carrilSel.sesion_id)
      : carrilSel.estado === 'libre'
        ? disponibles
        : []
  const puedeLibre = !!carrilSel && carrilSel.estado === 'libre'
  const nombreSesion = (d: { entrenador: string | null; grupo: string | null }) => `${d.entrenador ?? 'entrenador'} · ${d.grupo ?? 'sesión libre'}`
  const tipoDeMiSesion = (x: Sesion) => (x.iniciada_por_rol === 'nadador' ? 'sesión personal (solo vos la ves)' : (x.grupo ?? 'sesión libre'))

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
                  ? `${esMia ? `En curso · ${tipoDeMiSesion(sesion)}` : `En la sesión de ${nombreSesion({ entrenador: sesion.iniciada_por, grupo: sesion.grupo })}`} · ${formatearDuracion(ahora - Date.parse(sesion.inicio))}`
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
          {!esNadador && (
            <label className="mb-4 block text-sm font-medium text-slate-700">
              La sesión es de
              <select
                value={grupoSesion}
                onChange={(e) => {
                  const v = e.target.value
                  setGrupoSesion(v)
                  setEleccion({})
                }}
                className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:w-96"
              >
                <option value="">Sesión libre (cualquier nadador puede sumarse)</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    Grupo {g.nombre} ({g.nadadores.length})
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-sm font-medium text-slate-700">
            {esNadador ? 'Elegí un carril' : 'Elegí los carriles y quién va en cada uno'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {carriles.map((c) => (
              <div key={c.carril} className={`rounded-xl border p-4 ${ESTILO_CARRIL[c.estado]} ${carrilElegido === c.carril ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Carril {c.carril}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {c.estado === 'libre' && 'Libre'}
                    {c.estado === 'ocupado' && 'En uso'}
                    {c.estado === 'grupo' && (c.con_nadador ? 'Sesión de entrenador · ocupado' : 'Sesión de entrenador · libre')}
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
                    {candidatos.map((n) => (
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
          </div>

          {/* el nadador elige: entrenar con su entrenador, o en su espacio personal (que el entrenador no ve) */}
          {esNadador && !carrilSel && <p className="text-sm text-slate-500">Elegí un carril y después cómo querés entrenar.</p>}
          {esNadador && carrilSel && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-xl border p-4 ${paraSumarme.length ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <p className="flex items-center gap-2 font-semibold text-slate-800">
                  <UserPlus className="size-4 text-blue-600" /> Con mi entrenador
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Te sumás a su sesión. Tu entrenador ve tus tiempos y tus métricas; los demás nadadores no.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {paraSumarme.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => unirse(d.id, carrilElegido!)}
                      disabled={ocupado}
                      className="rounded-lg bg-blue-600 px-4 py-2.5 text-left text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Sumarme a {nombreSesion(d)}
                    </button>
                  ))}
                  {paraSumarme.length === 0 && (
                    <p className="text-xs text-slate-500">
                      {disponibles.length === 0
                        ? 'Ningún entrenador tiene ahora una sesión a la que te puedas sumar.'
                        : 'Ese carril está en otra sesión: elegí un carril libre o uno reservado de la sesión de tu entrenador.'}
                    </p>
                  )}
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${puedeLibre ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <p className="flex items-center gap-2 font-semibold text-slate-800">
                  <Lock className="size-4 text-emerald-600" /> En mi espacio personal
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Una sesión solo tuya. <strong>Tu entrenador no tiene acceso</strong>: no la ve, ni ve sus resultados.
                </p>
                <button
                  onClick={() => iniciar([{ carril: carrilElegido! }])}
                  disabled={ocupado || !puedeLibre}
                  className="mt-3 w-full rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                >
                  Empezar mi sesión personal
                </button>
                {!puedeLibre && <p className="mt-2 text-xs text-slate-500">Solo en un carril libre.</p>}
              </div>
            </div>
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
