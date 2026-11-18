'use client'

import { Activity, Gauge, History, Waves } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { GraficaVelocidad } from '@/components/grafica-velocidad'
import { ErrorApi, api } from '@/lib/api'
import { csvDeSesion, descargarCsv, nombreCsv } from '@/lib/csv-sesion'
import { useCuenta } from '@/lib/cuenta'
import { formatearDuracion, formatearVelocidad } from '@/lib/resultados'
import type { Grupo, ResultadosSesion, ResumenSesion } from '@/lib/tipos'

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000

/** La gráfica de velocidad de una sesión abierta en la tabla: se pide al abrirla. */
type Grafica = { estado: 'cargando' } | { estado: 'error'; mensaje: string } | { estado: 'lista'; resultados: ResultadosSesion }

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Totales de los últimos 7 días y la lista de las últimas sesiones, todo desde la base (GET /api/sesiones). */
export function HistorialSesiones() {
  const esNadador = useCuenta().usuario?.rol === 'nadador'
  const [sesiones, setSesiones] = useState<ResumenSesion[] | null>(null)
  // el entrenador puede filtrar por grupo y ver quiénes lo forman
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoId, setGrupoId] = useState('')
  useEffect(() => {
    if (esNadador) return
    api.grupos().then(setGrupos).catch(() => setGrupos([]))
  }, [esNadador])
  const [problema, setProblema] = useState<string | null>(null)
  const [graficas, setGraficas] = useState<Record<string, Grafica>>({})

  /** Baja los eventos y tramos de una sesión como CSV (para depurar). Reusa los resultados si ya se pidieron para la gráfica. */
  async function bajarCsv(s: ResumenSesion) {
    try {
      const abierta = graficas[s.id]
      const resultados = abierta?.estado === 'lista' ? abierta.resultados : await api.resultadosSesion(s.id)
      const nadadores = Object.fromEntries(s.por_carril.map((c) => [c.carril, c.nadador]))
      descargarCsv(nombreCsv(s), csvDeSesion(s, resultados, nadadores))
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudo bajar el CSV de la sesión.')
    }
  }

  /** Abre o cierra la gráfica de velocidad de una sesión (los resultados se piden al abrirla). */
  async function alternarGrafica(id: string) {
    if (graficas[id]) {
      setGraficas((g) => Object.fromEntries(Object.entries(g).filter(([k]) => k !== id)))
      return
    }
    setGraficas((g) => ({ ...g, [id]: { estado: 'cargando' } }))
    try {
      const resultados = await api.resultadosSesion(id)
      setGraficas((g) => (id in g ? { ...g, [id]: { estado: 'lista', resultados } } : g)) // si la cerró mientras cargaba, no se reabre
    } catch (e) {
      const mensaje = e instanceof ErrorApi ? e.message : 'No se pudieron cargar los resultados de la sesión.'
      setGraficas((g) => (id in g ? { ...g, [id]: { estado: 'error', mensaje } } : g))
    }
  }

  const cargar = useCallback(async () => {
    try {
      setSesiones(await api.sesionesRecientes(20))
      setProblema(null)
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudo cargar el historial.')
    }
  }, [])

  // se recarga cuando una sesión empieza o termina (avisos en vivo del backend)
  useEffect(() => {
    void cargar()
    if (typeof EventSource === 'undefined') return
    const avisos = new EventSource('/api/sesiones/eventos')
    avisos.addEventListener('sesion_iniciada', () => void cargar())
    avisos.addEventListener('sesion_finalizada', () => void cargar())
    return () => avisos.close()
  }, [cargar])

  const grupo = grupos.find((g) => g.id === grupoId) ?? null
  const delGrupo = (sesiones ?? []).filter((s) => !grupoId || (grupoId === 'libre' ? !s.grupo_id : s.grupo_id === grupoId))
  const desde = Date.now() - SEMANA_MS
  const semana = delGrupo.filter((s) => Date.parse(s.inicio) >= desde)
  const metros = semana.reduce((a, s) => a + s.distancia_m, 0)
  const conVelocidad = semana.filter((s) => s.velocidad_media_ms !== null)
  const velocidad = conVelocidad.length ? conVelocidad.reduce((a, s) => a + (s.velocidad_media_ms ?? 0), 0) / conVelocidad.length : null

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica icono={Activity} etiqueta="Sesiones (últimos 7 días)" valor={sesiones ? String(semana.length) : '…'} />
        <Metrica icono={Waves} etiqueta="Distancia medida (7 días)" valor={sesiones ? `${Math.round(metros)} m` : '…'} />
        <Metrica icono={Gauge} etiqueta="Velocidad media (7 días)" valor={sesiones ? formatearVelocidad(velocidad) : '…'} />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <History className="size-5 text-blue-600" />
          <h3 className="font-semibold">Sesiones recientes</h3>
          {!esNadador && grupos.length > 0 && (
            <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" aria-label="Filtrar por grupo">
              <option value="">Todos los grupos</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              <option value="libre">Sesiones libres</option>
            </select>
          )}
        </div>
        {grupo && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500">{grupo.nombre}:</span>
            {grupo.nadadores.length === 0 && <span className="text-slate-400">sin nadadores</span>}
            {grupo.nadadores.map((n) => <span key={n.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{n.nombre}</span>)}
          </div>
        )}
        {problema && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{problema}</p>}
        {!problema && sesiones === null && <p className="mt-4 text-sm text-slate-500">Cargando…</p>}
        {!problema && sesiones !== null && delGrupo.length === 0 && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Todavía no hay sesiones. Aparecen aquí cuando se inicia la primera.</p>
        )}
        {!problema && delGrupo.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Inicio</th>
                  <th className="py-2 pr-4 font-semibold">Duración</th>
                  <th className="py-2 pr-4 font-semibold">Carril</th>
                  <th className="py-2 pr-4 font-semibold">Nadador</th>
                  <th className="py-2 pr-4 font-semibold">Tramos</th>
                  <th className="py-2 pr-4 font-semibold">Distancia</th>
                  <th className="py-2 pr-4 font-semibold">Velocidad media</th>
                  <th className="py-2 pr-4 font-semibold">Iniciada por</th>
                  <th className="py-2 font-semibold">Velocidad en el tiempo</th>
                </tr>
              </thead>
              {/* un <tbody> por sesión: sus datos (inicio, duración, quién la inició) una vez, y debajo una fila por carril */}
              {delGrupo.map((s) => {
                const filas = s.por_carril.length ? s.por_carril : [null]
                const span = filas.length
                const grafica = graficas[s.id]
                return (
                  <tbody key={s.id} className="border-t border-slate-100">
                    {filas.map((c, i) => (
                      <tr key={c?.carril ?? 'sin-carriles'} className={i > 0 ? 'border-t border-dashed border-slate-100' : ''}>
                        {i === 0 && (
                          <>
                            <td rowSpan={span} className="py-3 pr-4 align-top capitalize">{fecha(s.inicio)}</td>
                            <td rowSpan={span} className="py-3 pr-4 align-top">
                              {s.fin ? formatearDuracion(Date.parse(s.fin) - Date.parse(s.inicio)) : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">En curso</span>}
                            </td>
                          </>
                        )}
                        <td className="py-2.5 pr-4">{c ? c.carril : '—'}</td>
                        <td className="py-2.5 pr-4">
                          {c?.nadador ?? '—'}
                          {c && c.tramos > 0 && (
                            <Link href={esNadador ? `/nadador/sesiones/${s.id}` : `/entrenador/historial/${s.id}?carril=${c.carril}`} className="block text-xs font-medium text-blue-600 hover:underline">
                              Ver largos
                            </Link>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">{c ? c.tramos : '—'}</td>
                        <td className="py-2.5 pr-4">{c?.distancia_m ? `${Math.round(c.distancia_m)} m` : '—'}</td>
                        <td className="py-2.5 pr-4">{c ? formatearVelocidad(c.velocidad_media_ms) : '—'}</td>
                        {i === 0 && <td rowSpan={span} className="py-3 pr-4 align-top text-slate-500">{s.iniciada_por ?? '—'}</td>}
                        {i === 0 && (
                          <td rowSpan={span} className="py-3 align-top whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void alternarGrafica(s.id)}
                              aria-expanded={!!grafica}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                            >
                              {grafica ? 'Ocultar' : 'Ver gráfica'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void bajarCsv(s)}
                              title="Eventos y tramos de la sesión, para depurar"
                              className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              CSV
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {grafica && (
                      <tr>
                        <td colSpan={9} className="pb-5">
                          {grafica.estado === 'cargando' && <p className="text-sm text-slate-500">Cargando…</p>}
                          {grafica.estado === 'error' && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{grafica.mensaje}</p>}
                          {grafica.estado === 'lista' &&
                            (grafica.resultados.tramos.length === 0 ? (
                              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Esta sesión no tiene tramos medidos todavía.</p>
                            ) : (
                              <GraficaVelocidad
                                tramos={grafica.resultados.tramos}
                                eventos={grafica.resultados.eventos}
                                inicio={Date.parse(s.inicio)}
                                hasta={s.fin ? Date.parse(s.fin) : Date.now()}
                                enCurso={!s.fin}
                                nadadores={Object.fromEntries(s.por_carril.map((c) => [c.carril, c.nadador]))}
                              />
                            ))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Metrica({ icono: Icono, etiqueta, valor }: { icono: typeof Activity; etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icono className="size-4" /></span>
      <p className="mt-5 text-sm text-slate-400">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{valor}</p>
    </div>
  )
}
