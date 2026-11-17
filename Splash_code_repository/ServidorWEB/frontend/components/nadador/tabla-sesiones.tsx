'use client'

import Link from 'next/link'

import { type FilaSesion, fechaCorta, formatearMetros, formatearVel, horaCorta } from '@/lib/largos'
import { formatearDuracion } from '@/lib/resultados'

import { BOTON, EstadoSesion } from './ui'

/** Tabla de sesiones del nadador. `completa`: con hora y carril (historial); si no, la versión corta (resumen). */
export function TablaSesiones({ filas, completa = false }: { filas: FilaSesion[]; completa?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm tabular-nums ${completa ? 'min-w-[52rem]' : 'min-w-[40rem]'}`}>
        <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
          <tr>
            <th className="py-2 pr-4 font-semibold">Fecha</th>
            {completa && <th className="py-2 pr-4 font-semibold">Hora</th>}
            <th className="py-2 pr-4 font-semibold">Duración</th>
            {completa && <th className="py-2 pr-4 font-semibold">Carril</th>}
            <th className="py-2 pr-4 text-right font-semibold">Distancia</th>
            <th className="py-2 pr-4 text-right font-semibold">Velocidad media</th>
            <th className="py-2 pr-4 text-right font-semibold">Largos</th>
            <th className="py-2 pr-4 font-semibold">Estado</th>
            <th className="py-2 font-semibold"><span className="sr-only">Acción</span></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.sesion.id} className="border-t border-[#F1F5F9]">
              <td className="py-3 pr-4">{fechaCorta(f.sesion.inicio)}</td>
              {completa && <td className="py-3 pr-4">{horaCorta(f.sesion.inicio)}</td>}
              <td className="py-3 pr-4">{f.duracion_s === null ? '—' : formatearDuracion(f.duracion_s * 1000)}</td>
              {completa && <td className="py-3 pr-4">{f.carriles.length ? f.carriles.join(', ') : '—'}</td>}
              <td className="py-3 pr-4 text-right">{formatearMetros(f.distancia_m)}</td>
              <td className="py-3 pr-4 text-right">{formatearVel(f.velocidad_media_ms)}</td>
              <td className="py-3 pr-4 text-right">
                {f.largos}
              </td>
              <td className="py-3 pr-4"><EstadoSesion estado={f.sesion.estado} /></td>
              <td className="py-3 text-right">
                <Link href={`/nadador/sesiones/${f.sesion.id}`} className={`${BOTON.primario} px-3 py-1.5 text-xs`}>Ver detalles</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
