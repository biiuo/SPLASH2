'use client'

// Piezas visuales de los grupos: el nivel, el horario de clases y el fondo azul con ondas de las tarjetas.
import type { DiaSemana, HorarioGrupo, NivelGrupo } from '@/lib/tipos'

export const DIAS: { id: DiaSemana; corto: string; largo: string }[] = [
  { id: 'lun', corto: 'L', largo: 'Lunes' },
  { id: 'mar', corto: 'M', largo: 'Martes' },
  { id: 'mie', corto: 'X', largo: 'Miércoles' },
  { id: 'jue', corto: 'J', largo: 'Jueves' },
  { id: 'vie', corto: 'V', largo: 'Viernes' },
  { id: 'sab', corto: 'S', largo: 'Sábado' },
  { id: 'dom', corto: 'D', largo: 'Domingo' },
]

export const NIVELES: { id: NivelGrupo; texto: string }[] = [
  { id: 'principiante', texto: 'Principiante' },
  { id: 'intermedio', texto: 'Intermedio' },
  { id: 'avanzado', texto: 'Avanzado' },
  { id: 'competitivo', texto: 'Competitivo' },
]

/** "Lun, Mié, Vie · 06:00–07:30" */
export function textoHorario(h: HorarioGrupo | null | undefined): string | null {
  if (!h || !h.dias.length) return null
  const dias = DIAS.filter((d) => h.dias.includes(d.id)).map((d) => d.largo.slice(0, 3))
  return `${dias.join(', ')} · ${h.inicio}–${h.fin}`
}

/** Los siete días como pastillas: encendidas las del horario. Sobre fondo azul (`claro`) o blanco. */
export function DiasSemana({ h, claro = false }: { h: HorarioGrupo | null | undefined; claro?: boolean }) {
  return (
    <div className="flex gap-1" aria-label={textoHorario(h) ?? 'Sin horario'}>
      {DIAS.map((d) => {
        const on = !!h?.dias.includes(d.id)
        const clase = claro
          ? on
            ? 'bg-white text-[#1D4ED8]'
            : 'bg-white/15 text-white/60'
          : on
            ? 'bg-[#2563EB] text-white'
            : 'bg-[#EFF6FF] text-[#93C5FD]'
        return (
          <span key={d.id} title={d.largo} className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${clase}`}>
            {d.corto}
          </span>
        )
      })}
    </div>
  )
}

export function Nivel({ n, claro = false }: { n: NivelGrupo | null | undefined; claro?: boolean }) {
  if (!n) return null
  const texto = NIVELES.find((x) => x.id === n)?.texto ?? n
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${claro ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] text-[#1D4ED8]'}`}>
      {texto}
    </span>
  )
}

/** Degradados para las tarjetas de grupos: cada grupo toma uno según su posición. */
const PALETAS = [
  'from-[#1D4ED8] via-[#1D63ED] to-[#38BDF8]',
  'from-[#0E7490] via-[#0891B2] to-[#22D3EE]',
  'from-[#4338CA] via-[#4F46E5] to-[#06B6D4]',
  'from-[#0F766E] via-[#0D9488] to-[#5EEAD4]',
  'from-[#082644] via-[#113258] to-[#38BDF8]',
]

/** Fondo degradado con dos ondas, para las tarjetas y el encabezado de un grupo. `paleta` elige el degradado. */
export function FondoAgua({ children, className = '', paleta = 0 }: { children: React.ReactNode; className?: string; paleta?: number }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${PALETAS[paleta % PALETAS.length]} text-white ${className}`}>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40 C 60 20, 120 60, 200 40 S 340 20, 400 40 V80 H0 Z" fill="white" fillOpacity="0.10" />
        <path d="M0 55 C 80 35, 150 75, 230 55 S 360 40, 400 58 V80 H0 Z" fill="white" fillOpacity="0.10" />
      </svg>
      <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  )
}
