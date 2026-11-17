'use client'

// Piezas visuales del módulo del nadador, con la paleta de SafeSplash:
// azul #2563EB (acción), #1D4ED8 (hover/activo), #EFF6FF (fondo suave); texto #0F172A / #64748B; bordes #E2E8F0.
// Verde, amarillo y rojo solo para ESTADOS; naranja (#FFF7ED / #C2410C) solo para datos ESTIMADOS.
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import { type FilaSesion, filaDeSesion } from '@/lib/largos'
import type { Sesion } from '@/lib/tipos'

export const BOTON = {
  primario:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--acento,#2563EB)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--acento,#2563EB)]/25 transition hover:brightness-110 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:shadow-none',
  secundario:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--acento-suave,#EFF6FF)] px-4 py-2.5 text-sm font-semibold text-[var(--acento-texto,#1D4ED8)] transition hover:brightness-95 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]',
  terciario:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#334155] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]',
  peligro:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B91C1C] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]',
}

export const CAMPO = 'mt-1 block w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[var(--acento,#2563EB)] focus:ring-4 focus:ring-[var(--acento-suave,#EFF6FF)]'

export function Tarjeta({ titulo, subtitulo, accion, children, className = '' }: { titulo?: string; subtitulo?: string; accion?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white bg-white/90 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6 ${className}`}>
      {(titulo || accion) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="font-semibold text-[#0F172A]">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-xs text-[#64748B]">{subtitulo}</p>}
          </div>
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

/** Indicador: ícono, nombre, valor y unidad. */
export function Kpi({ icono: Icono, etiqueta, valor, unidad, nota }: { icono: LucideIcon; etiqueta: string; valor: string; unidad?: string; nota?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white bg-white/90 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5">
      <span className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-[var(--acento-suave,#EFF6FF)] transition group-hover:scale-110" aria-hidden="true" />
      <span className="relative flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--acento,#2563EB)] to-[var(--acento-2,#38BDF8)] text-white shadow-md shadow-[var(--acento,#2563EB)]/30"><Icono className="size-4" /></span>
      <p className="relative mt-4 text-sm text-[#64748B]">{etiqueta}</p>
      <p className="relative mt-1 text-2xl font-semibold tracking-tight text-[#0F172A]">
        {valor}
        {unidad && valor !== '—' && <span className="ml-1 text-sm font-medium text-[#64748B]">{unidad}</span>}
      </p>
      {nota && <p className="relative mt-1 text-xs text-[#94A3B8]">{nota}</p>}
    </div>
  )
}

const ESTADOS: Record<Sesion['estado'], { texto: string; clase: string }> = {
  activa: { texto: 'En curso', clase: 'bg-[#DCFCE7] text-[#166534]' },
  finalizada: { texto: 'Finalizada', clase: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  cancelada: { texto: 'Cancelada', clase: 'bg-[#FEE2E2] text-[#991B1B]' },
}

export function EstadoSesion({ estado }: { estado: Sesion['estado'] }) {
  const e = ESTADOS[estado]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>{e.texto}</span>
}

/** Detectado (medición confirmada) o estimado (no se veía al nadador): nunca se presentan igual. */
export function Registro({ estimado }: { estimado: boolean }) {
  return estimado ? (
    <span className="inline-flex rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-xs font-semibold text-[#C2410C]" title="En algún momento no se veía al nadador: el tiempo se calculó con su velocidad">
      Estimado
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-semibold text-[#475569]">Detectado</span>
  )
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'estimado'; children: React.ReactNode }) {
  const clase = tipo === 'error' ? 'bg-[#FEE2E2] text-[#991B1B]' : tipo === 'estimado' ? 'bg-[#FFF7ED] text-[#C2410C]' : 'bg-[#F1F5F9] text-[#475569]'
  return <p role={tipo === 'error' ? 'alert' : undefined} className={`rounded-xl px-4 py-3 text-sm ${clase}`}>{children}</p>
}

/**
 * Las sesiones de quien mira, con lo suyo resumido. El backend ya filtra: un nadador ve sus sesiones personales y
 * las de entrenadores donde tuvo un carril, y de esas solo su carril.
 */
export function useMisSesiones(limite = 100) {
  const [filas, setFilas] = useState<FilaSesion[] | null>(null)
  const [problema, setProblema] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setFilas((await api.sesionesRecientes(limite)).map(filaDeSesion))
      setProblema(null)
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.')
    }
  }, [limite])

  useEffect(() => {
    void cargar()
    if (typeof EventSource === 'undefined') return
    const avisos = new EventSource('/api/sesiones/eventos')
    avisos.addEventListener('sesion_iniciada', () => void cargar())
    avisos.addEventListener('sesion_finalizada', () => void cargar())
    return () => avisos.close()
  }, [cargar])

  return { filas, problema, recargar: cargar }
}
