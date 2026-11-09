'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import type { CalibracionResumen } from '@/lib/tipos'
import { esCarril } from '@/lib/zonas'

const cm = (m: number | null) => (m === null ? '—' : `${(m * 100).toFixed(1)} cm`)
const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Las posiciones de la cámara guardadas. Cada una es una calibración (píxeles -> metros) con sus zonas de análisis:
 * si la cámara se mueve, se calibra de nuevo y se elige acá cuál usar.
 */
export function CalibracionesGuardadas() {
  const [lista, setLista] = useState<CalibracionResumen[] | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [activando, setActivando] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      setLista(await api.historialCalibraciones())
      setProblema(null)
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las calibraciones.')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function activar(id: string) {
    setActivando(id)
    try {
      await api.activarCalibracion(id)
      await cargar()
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudo activar la calibración.')
    } finally {
      setActivando(null)
    }
  }

  async function renombrar() {
    if (!editando) return
    try {
      await api.actualizarCalibracion(editando.id, { nombre: editando.nombre.trim() || null })
      setEditando(null)
      await cargar()
    } catch (e) {
      setProblema(e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'No se pudo cambiar el nombre.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-blue-600">
          <Link href="/calibracion" className="hover:underline">← Volver a la calibración</Link>
          <Link href="/zonas" className="hover:underline">Zonas de análisis</Link>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Posiciones de la cámara</h1>
        <p className="mt-2 text-slate-500">
          Cada posición guarda su calibración y sus zonas. Si movés la cámara, calibrá de nuevo y dibujá sus zonas; si la
          volvés a poner donde estaba, elegí acá esa posición. Las sesiones nuevas usan la activa; las que ya empezaron
          siguen con la que tenían, así que cambiarla no altera sus resultados.
        </p>

        {problema && <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{problema}</p>}
        {!lista && !problema && <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Cargando…</p>}
        {lista && lista.length === 0 && (
          <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            Todavía no hay ninguna. <Link href="/calibracion" className="font-semibold text-blue-600 underline">Calibrar ahora</Link>
          </p>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {lista?.map((c) => {
            const carriles = c.zonas.filter(esCarril)
            return (
              <li key={c.id} className={`rounded-2xl border bg-white p-5 ${c.activa ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editando?.id === c.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          void renombrar()
                        }}
                        className="flex gap-2"
                      >
                        <input
                          autoFocus
                          value={editando.nombre}
                          maxLength={80}
                          placeholder="Por ejemplo: Tribuna, lado norte"
                          onChange={(e) => setEditando({ id: c.id, nombre: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button type="submit" className="rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">Guardar</button>
                        <button type="button" onClick={() => setEditando(null)} className="text-sm text-slate-500">Cancelar</button>
                      </form>
                    ) : (
                      <p className="font-semibold">
                        {c.nombre ?? <span className="text-slate-400">Sin nombre</span>}
                        <button
                          onClick={() => setEditando({ id: c.id, nombre: c.nombre ?? '' })}
                          className="ml-2 text-xs font-medium text-blue-600 hover:underline"
                        >
                          {c.nombre ? 'Renombrar' : 'Ponerle nombre'}
                        </button>
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      {fecha(c.creada)} · {c.n_puntos} puntos · error de ajuste {cm(c.rmse_m)} · error al dejar un punto afuera {cm(c.cruzado_m)}
                    </p>
                    <p className="mt-1 text-sm">
                      {c.zonas.length === 0 ? (
                        <span className="font-medium text-amber-700">Sin zonas: el servidor de IA no sabrá qué carril es cada nadador.</span>
                      ) : (
                        <span className="text-slate-600">
                          Zonas: {c.zonas.join(', ')}
                          {carriles.length === 0 && <span className="font-medium text-amber-700"> (ningún carril)</span>}
                        </span>
                      )}{' '}
                      <Link href={`/zonas?calibracion=${encodeURIComponent(c.id)}`} className="font-medium text-blue-600 hover:underline">
                        {c.zonas.length === 0 ? 'Dibujar zonas' : 'Editar zonas'}
                      </Link>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.completa ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {c.completa ? 'Completa' : 'Incompleta'}
                    </span>
                    {c.activa ? (
                      <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Activa</span>
                    ) : (
                      <button
                        onClick={() => activar(c.id)}
                        disabled={activando !== null}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {activando === c.id ? 'Activando…' : 'Usar esta'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
