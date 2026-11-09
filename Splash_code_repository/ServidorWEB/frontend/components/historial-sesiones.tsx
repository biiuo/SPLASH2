'use client'

import { Activity, Gauge, History, Waves } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import { formatearDuracion, formatearVelocidad } from '@/lib/resultados'
import type { ResumenSesion } from '@/lib/tipos'

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Totales de los últimos 7 días y la lista de las últimas sesiones, todo desde la base (GET /api/sesiones). */
export function HistorialSesiones() {
  const [sesiones, setSesiones] = useState<ResumenSesion[] | null>(null)
  const [problema, setProblema] = useState<string | null>(null)

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

  const desde = Date.now() - SEMANA_MS
  const semana = (sesiones ?? []).filter((s) => Date.parse(s.inicio) >= desde)
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
        </div>
        {problema && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{problema}</p>}
        {!problema && sesiones === null && <p className="mt-4 text-sm text-slate-500">Cargando…</p>}
        {!problema && sesiones?.length === 0 && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Todavía no hay sesiones. Aparecen aquí cuando se inicia la primera.</p>
        )}
        {!problema && !!sesiones?.length && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Inicio</th>
                  <th className="py-2 pr-4 font-semibold">Duración</th>
                  <th className="py-2 pr-4 font-semibold">Carriles</th>
                  <th className="py-2 pr-4 font-semibold">Tramos</th>
                  <th className="py-2 pr-4 font-semibold">Distancia</th>
                  <th className="py-2 pr-4 font-semibold">Velocidad media</th>
                  <th className="py-2 font-semibold">Iniciada por</th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 capitalize">{fecha(s.inicio)}</td>
                    <td className="py-3 pr-4">
                      {s.fin ? formatearDuracion(Date.parse(s.fin) - Date.parse(s.inicio)) : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">En curso</span>}
                    </td>
                    <td className="py-3 pr-4">{s.carriles.length ? s.carriles.join(', ') : '—'}</td>
                    <td className="py-3 pr-4">{s.tramos}</td>
                    <td className="py-3 pr-4">{s.distancia_m ? `${Math.round(s.distancia_m)} m` : '—'}</td>
                    <td className="py-3 pr-4">{formatearVelocidad(s.velocidad_media_ms)}</td>
                    <td className="py-3 text-slate-500">{s.iniciada_por ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
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
