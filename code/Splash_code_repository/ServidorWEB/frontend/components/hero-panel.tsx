'use client'

/* eslint-disable @next/next/no-img-element -- fotos locales de /public, sin optimizador (images.unoptimized) */

const FOTOS = ['/images/piscina/foto-piscina-1.jpeg', '/images/piscina/foto-piscina-2.jpeg', '/images/piscina/foto-piscina-3.jpeg']

/**
 * El encabezado de la página de inicio de cada módulo: una foto de la piscina, el azul marino de la portada fundido
 * con el color del rol, y las ondas abajo. `lateral` va a la derecha (cifras grandes, por ejemplo).
 */
export function HeroPanel({
  foto = 1,
  etiqueta,
  titulo,
  resaltado,
  bajada,
  acciones,
  lateral,
}: {
  foto?: 1 | 2 | 3
  etiqueta?: string
  titulo: string
  /** Una segunda línea del título, en el color del rol. */
  resaltado?: string
  bajada?: string
  acciones?: React.ReactNode
  lateral?: React.ReactNode
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--marino-1)] text-white shadow-xl shadow-[var(--marino-1)]/20">
      <img src={FOTOS[foto - 1]} alt="" className="absolute inset-0 size-full object-cover opacity-80" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--marino-1)]/95 via-[var(--marino-1)]/70 to-[var(--acento)]/35" aria-hidden="true" />
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full" viewBox="0 0 800 64" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30 C 120 10, 220 50, 360 30 S 620 10, 800 32 V64 H0 Z" fill="var(--acento-2)" fillOpacity="0.25" />
        <path d="M0 44 C 140 26, 260 62, 420 44 S 680 30, 800 46 V64 H0 Z" fill="var(--acento)" fillOpacity="0.35" />
      </svg>
      <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 pb-14 sm:p-8 sm:pb-16">
        <div className="max-w-2xl">
          {etiqueta && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-100 backdrop-blur">
              <span className="size-1.5 rounded-full bg-[var(--acento-2)]" aria-hidden="true" />
              {etiqueta}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {titulo}
            {resaltado && <span className="block bg-gradient-to-r from-[var(--acento-2)] to-[#BAE6FD] bg-clip-text text-transparent">{resaltado}</span>}
          </h1>
          {bajada && <p className="mt-2 text-sky-100/80">{bajada}</p>}
          {acciones && <div className="mt-5 flex flex-wrap gap-2">{acciones}</div>}
        </div>
        {lateral && <div className="flex gap-6">{lateral}</div>}
      </div>
    </section>
  )
}

/** Una cifra grande para el lado derecho del encabezado. */
export function CifraHero({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right backdrop-blur">
      <p className="text-4xl font-bold leading-none">{valor}</p>
      <p className="mt-1 text-xs text-sky-100/80">{texto}</p>
    </div>
  )
}

/** Botones del encabezado: uno claro (principal) y uno de vidrio. */
export const BOTON_HERO = {
  claro: 'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E0F7FA] via-[#BAE6FD] to-[#7DD3FC] px-5 py-2.5 text-sm font-semibold text-[#07213D] shadow-lg shadow-sky-400/30 transition hover:-translate-y-0.5',
  vidrio: 'inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20',
}
