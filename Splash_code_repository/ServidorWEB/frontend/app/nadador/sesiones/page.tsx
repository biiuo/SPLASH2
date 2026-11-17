'use client'

import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Encabezado } from '@/components/nadador/shell'
import { TablaSesiones } from '@/components/nadador/tabla-sesiones'
import { Aviso, BOTON, CAMPO, Tarjeta, useMisSesiones } from '@/components/nadador/ui'
import { descargarTexto, historialCsv } from '@/lib/largos'
import type { Sesion } from '@/lib/tipos'

const DIA = 24 * 60 * 60 * 1000
type Orden = 'fecha_desc' | 'fecha_asc' | 'distancia' | 'velocidad'
const INICIAL = { dia: '', periodo: 'todo', estado: 'todos' as 'todos' | Sesion['estado'], orden: 'fecha_desc' as Orden }

/** Mis sesiones: el historial completo, con filtros, orden y exportación. */
export default function MisSesiones() {
  const { filas, problema } = useMisSesiones()
  const [f, setF] = useState(INICIAL)

  const visibles = useMemo(() => {
    if (!filas) return null
    const ahora = Date.now()
    const r = filas.filter((x) => {
      const t = Date.parse(x.sesion.inicio)
      if (f.periodo !== 'todo' && t < ahora - Number(f.periodo) * DIA) return false
      if (f.estado !== 'todos' && x.sesion.estado !== f.estado) return false
      if (f.dia) {
        const d = new Date(x.sesion.inicio)
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (local !== f.dia) return false
      }
      return true
    })
    const por: Record<Orden, (a: (typeof r)[number], b: (typeof r)[number]) => number> = {
      fecha_desc: (a, b) => b.sesion.inicio.localeCompare(a.sesion.inicio),
      fecha_asc: (a, b) => a.sesion.inicio.localeCompare(b.sesion.inicio),
      distancia: (a, b) => b.distancia_m - a.distancia_m,
      velocidad: (a, b) => (b.velocidad_media_ms ?? -1) - (a.velocidad_media_ms ?? -1),
    }
    return r.sort(por[f.orden])
  }, [filas, f])

  const cambiado = JSON.stringify(f) !== JSON.stringify(INICIAL)

  return (
    <>
      <Encabezado
        titulo="Mis sesiones"
        bajada="Todos tus entrenamientos. Elegí uno para ver sus largos, tiempos y velocidades."
        accion={
          <button
            onClick={() => visibles && descargarTexto(`safesplash_historial_${new Date().toISOString().slice(0, 10)}.csv`, historialCsv(visibles), 'text/csv')}
            disabled={!visibles?.length}
            className={BOTON.secundario}
          >
            <Download className="size-4" /> Exportar historial (.csv)
          </button>
        }
      />

      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
          <label className="text-sm text-[#64748B]">
            Fecha
            <input type="date" value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} className={CAMPO} />
          </label>
          <label className="text-sm text-[#64748B]">
            Período
            <select value={f.periodo} onChange={(e) => setF({ ...f, periodo: e.target.value })} className={CAMPO}>
              <option value="todo">Todo</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 3 meses</option>
            </select>
          </label>
          <label className="text-sm text-[#64748B]">
            Estado
            <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as typeof f.estado })} className={CAMPO}>
              <option value="todos">Todos</option>
              <option value="activa">En curso</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="text-sm text-[#64748B]">
            Ordenar por
            <select value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value as Orden })} className={CAMPO}>
              <option value="fecha_desc">Fecha (más reciente)</option>
              <option value="fecha_asc">Fecha (más antigua)</option>
              <option value="distancia">Distancia (mayor)</option>
              <option value="velocidad">Velocidad (mayor)</option>
            </select>
          </label>
          <button onClick={() => setF(INICIAL)} disabled={!cambiado} className={BOTON.terciario}>Limpiar filtros</button>
        </div>
      </Tarjeta>

      <Tarjeta className="mt-6" titulo="Historial" subtitulo={visibles ? `${visibles.length} ${visibles.length === 1 ? 'sesión' : 'sesiones'}` : undefined}>
        {problema && <Aviso tipo="error">{problema}</Aviso>}
        {!problema && visibles === null && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {visibles?.length === 0 && <Aviso>{cambiado ? 'Ninguna sesión coincide con los filtros.' : 'Todavía no tenés sesiones.'}</Aviso>}
        {!!visibles?.length && <TablaSesiones filas={visibles} completa />}
      </Tarjeta>
    </>
  )
}
