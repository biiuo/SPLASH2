'use client'

import { type Cumplimiento, NOMBRE_TIPO, formatearMeta } from '@/lib/objetivos'
import type { Objetivo } from '@/lib/tipos'

const ESTADO: Record<Cumplimiento['estado'], { texto: string; clase: string; barra: string }> = {
  alcanzado: { texto: 'Alcanzado', clase: 'bg-[#DCFCE7] text-[#166534]', barra: 'bg-[#16A34A]' },
  en_curso: { texto: 'En curso', clase: 'bg-[#DBEAFE] text-[#1D4ED8]', barra: 'bg-[#2563EB]' },
  vencido: { texto: 'Vencido', clase: 'bg-[#FEE2E2] text-[#991B1B]', barra: 'bg-[#DC2626]' },
  por_empezar: { texto: 'Por empezar', clase: 'bg-[#F1F5F9] text-[#475569]', barra: 'bg-[#94A3B8]' },
}

/** Un objetivo con su barra de cumplimiento (la barra lleva el estado; el texto, el porcentaje y los valores). */
export function ProgresoObjetivo({ o, c, nombre = false }: { o: Objetivo; c: Cumplimiento; nombre?: boolean }) {
  const e = ESTADO[c.estado]
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-[#0F172A]">
          {nombre && <span>{o.nadador} · </span>}
          {NOMBRE_TIPO[o.tipo]}: {formatearMeta(o.tipo, o.meta)}
          {o.tipo === 'tiempo_largo' && ' o menos'}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>{e.texto}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#DBEAFE]" role="progressbar" aria-valuenow={c.porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label={`${NOMBRE_TIPO[o.tipo]}: ${c.porcentaje} %`}>
        <div className={`h-full rounded-full ${e.barra}`} style={{ width: `${c.porcentaje}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#64748B]">
        {c.porcentaje} % · lleva {formatearMeta(o.tipo, c.actual)} · del {new Date(`${o.desde}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} al{' '}
        {new Date(`${o.hasta}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
        {o.descripcion && ` · ${o.descripcion}`}
      </p>
    </div>
  )
}
