'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Menu, Waves, X } from 'lucide-react'
import { SwimmerBar } from '@/components/swimmer-bar'
import type { Usuario } from '@/lib/tipos'

export interface SlideItem {
  id: string
  tag: string
  title: string
  highlight: string
  desc: string
  cta: string
  cardTitle: string
  cardSub: string
  image: string
  fallbackImage?: string
}

/**
 * Fotos reales de piscina guardadas en public/images/piscina/
 * Adaptadas para el complejo acuático y sistema de visión computacional SafeSplash.
 */
export const SLIDES_DATA: SlideItem[] = [
  {
    id: 'uninorte-carriles-1',
    tag: 'COMPLEJO ACUÁTICO UNINORTE · PISCINA DE ENTRENAMIENTO',
    title: 'Cada largo cuenta.',
    highlight: 'Tu progreso, también.',
    desc: 'Cámaras calibradas sobre la piscina de la Universidad del Norte siguen a cada nadador en su carril, calculando tiempos exactos y parciales al pasar por cada marca.',
    cta: 'Comenzar a entrenar',
    cardTitle: 'Carriles de Entrenamiento',
    cardSub: 'Piscina Olímpica Uninorte',
    image: '/images/piscina/Foto%20piscina.jpeg',
    fallbackImage: '/images/piscina/foto-piscina-1.jpeg',
  },
  {
    id: 'uninorte-calibracion-2',
    tag: 'ANÁLISIS SIN SENSORES · VISIÓN COMPUTACIONAL',
    title: 'Sin cronómetro,',
    highlight: 'sin dispositivos encima.',
    desc: 'Nada con total libertad. Detección automática de salidas, parciales por tramo, velocidad media y virajes en tiempo real con inteligencia artificial.',
    cta: 'Ver cómo funciona',
    cardTitle: 'Calibración y Virajes',
    cardSub: 'Detección por homografía',
    image: '/images/piscina/Foto%20Piscina%202.jpeg',
    fallbackImage: '/images/piscina/foto-piscina-2.jpeg',
  },
  {
    id: 'uninorte-metricas-3',
    tag: 'ENTRENAMIENTO INTELIGENTE · MÉTRICAS REALES',
    title: 'Supera tu marca',
    highlight: 'largo tras largo.',
    desc: 'Compara tu evolución por sesión, identifica tus mejores parciales y comparte estadísticas de rendimiento directamente con tu entrenador.',
    cta: 'Explorar estadísticas',
    cardTitle: 'Ritmo y Velocidad',
    cardSub: 'Historial por sesión',
    image: '/images/piscina/foto-piscina-1.jpeg',
    fallbackImage: '/images/piscina/Foto%20piscina.jpeg',
  },
  {
    id: 'uninorte-rendimiento-4',
    tag: 'INSTALACIONES DE ALTO RENDIMIENTO · PANEL TÉCNICO',
    title: 'Tecnología integrada',
    highlight: 'en cada carril.',
    desc: 'Diseñado para nadadores y entrenadores, manteniendo un seguimiento continuo y claro de múltiples carriles en simultáneo.',
    cta: 'Crear cuenta gratis',
    cardTitle: 'Control de Sesión',
    cardSub: 'Monitoreo simultáneo',
    image: '/images/piscina/foto-piscina-2.jpeg',
    fallbackImage: '/images/piscina/Foto%20Piscina%202.jpeg',
  },
]

const SLIDE_DURATION_MS = 6500
const pad2 = (n: number) => String(n).padStart(2, '0')

interface HeroCarouselProps {
  usuario?: Usuario | null
  onLogin?: () => void
  onSignup?: () => void
  onPanel?: () => void
  onExploreHowItWorks?: () => void
}

export function HeroCarousel({
  usuario,
  onLogin,
  onSignup,
  onPanel,
  onExploreHowItWorks,
}: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [imageKey, setImageKey] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(true)

  const progressBarRef = useRef<HTMLDivElement>(null)
  const elapsedMsRef = useRef(0)
  const lastTsRef = useRef<number | null>(null)
  const animFrameRef = useRef<number>(0)

  const totalSlides = SLIDES_DATA.length

  const goToSlide = useCallback((index: number) => {
    elapsedMsRef.current = 0
    if (progressBarRef.current) {
      progressBarRef.current.style.width = '0%'
    }
    setImageLoaded(false)
    setCurrentSlide((index + totalSlides) % totalSlides)
    setImageKey((prev) => prev + 1)
    setTimeout(() => setImageLoaded(true), 120)
  }, [totalSlides])

  const goNext = useCallback(() => {
    goToSlide(currentSlide + 1)
  }, [currentSlide, goToSlide])

  const goPrev = useCallback(() => {
    goToSlide(currentSlide - 1)
  }, [currentSlide, goToSlide])

  // Bucle de temporización suave para el progreso del carrusel
  useEffect(() => {
    const loop = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts
      const dt = Math.min(ts - lastTsRef.current, 100)
      lastTsRef.current = ts

      if (autoAdvance) {
        elapsedMsRef.current += dt
        const pct = Math.min(100, (elapsedMsRef.current / SLIDE_DURATION_MS) * 100)
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${pct}%`
        }

        if (elapsedMsRef.current >= SLIDE_DURATION_MS) {
          elapsedMsRef.current = 0
          goToSlide(currentSlide + 1)
        }
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      lastTsRef.current = null
    }
  }, [autoAdvance, currentSlide, goToSlide])

  const currentItem = SLIDES_DATA[currentSlide]

  const handlePrimaryCta = () => {
    if (usuario) {
      onPanel?.()
    } else {
      onSignup?.()
    }
  }

  const handleHowItWorksClick = () => {
    if (onExploreHowItWorks) {
      onExploreHowItWorks()
    } else {
      const el = document.getElementById('como-funciona')
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Previsualización de las siguientes tarjetas a la derecha
  const previewCards = []
  const visibleCardsCount = Math.min(3, totalSlides)
  for (let offset = 1; offset <= visibleCardsCount; offset++) {
    const targetIdx = (currentSlide + offset) % totalSlides
    previewCards.push({
      item: SLIDES_DATA[targetIdx],
      targetIdx,
      isNext: offset === 1,
    })
  }

  return (
    <section
      id="heroCarouselSection"
      aria-label="Carrusel principal SafeSplash"
      className="relative flex min-h-[640px] w-full flex-1 flex-col justify-between overflow-hidden select-none bg-slate-950 text-white lg:min-h-[720px]"
    >
      {/* 1. CAPA DE FONDO DEL CARRUSEL (Fotos reales con efecto Ken Burns y degradados) */}
      <div id="heroBgLayer" className="absolute inset-0 z-0 bg-slate-900">
        <img
          key={imageKey}
          src={currentItem.image}
          alt={currentItem.cardTitle}
          onError={(e) => {
            if (currentItem.fallbackImage && e.currentTarget.src !== currentItem.fallbackImage) {
              e.currentTarget.src = currentItem.fallbackImage
            }
          }}
          className={`h-full w-full object-cover object-center transition-opacity duration-700 animate-ken-burns ${
            imageLoaded ? 'opacity-100' : 'opacity-40'
          }`}
        />
        {/* Degradados direccionales para perfecta legibilidad sobre cualquier fotografía */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/55" />
      </div>

      {/* 2. NAVBAR SUPERIOR INTEGRADO SOBRE EL HERO */}
      <header className="relative z-20 flex w-full items-center justify-between px-6 pt-5 pb-3 sm:px-12 lg:px-16">
        <button
          type="button"
          onClick={() => goToSlide(0)}
          className="group flex items-center gap-3 text-left"
          aria-label="SafeSplash Inicio"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D63ED] text-white shadow-lg shadow-blue-600/30 transition group-hover:scale-105">
            <Waves className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">SafeSplash</span>
        </button>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-200 md:flex">
          <button
            type="button"
            onClick={handleHowItWorksClick}
            className="cursor-pointer transition hover:text-white"
          >
            Cómo funciona
          </button>
          <span className="cursor-pointer transition hover:text-white" onClick={() => goToSlide(0)}>
            Carriles
          </span>
          <span className="cursor-pointer transition hover:text-white" onClick={() => goToSlide(1)}>
            Métricas
          </span>
        </nav>

        <div className="flex items-center gap-4">
          {usuario ? (
            <button
              type="button"
              onClick={onPanel}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D63ED] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 sm:text-sm"
            >
              <span>Ir a mi panel · {usuario.nombre.split(' ')[0]}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onLogin}
                className="hidden cursor-pointer text-sm font-medium text-slate-200 transition hover:text-white sm:inline"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={onSignup}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D63ED] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 sm:text-sm"
              >
                <span>Crear cuenta</span>
                <span aria-hidden="true">→</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-white md:hidden hover:bg-white/10"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div className="relative z-30 mx-5 flex flex-col gap-3 rounded-2xl border border-white/15 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-xl md:hidden">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false)
              handleHowItWorksClick()
            }}
            className="py-2 text-left text-sm font-medium text-slate-200 hover:text-white"
          >
            Cómo funciona
          </button>
          {usuario ? (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                onPanel?.()
              }}
              className="rounded-xl bg-[#1D63ED] py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30"
            >
              Ir a mi panel · {usuario.nombre}
            </button>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onLogin?.()
                }}
                className="rounded-xl border border-white/20 bg-white/5 py-2.5 text-center text-sm font-medium text-white"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onSignup?.()
                }}
                className="rounded-xl bg-[#1D63ED] py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/30"
              >
                Crear cuenta
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. CONTENIDO PRINCIPAL DEL CARRUSEL (Rail editorial + Texto Hero + Tarjetas Preview) */}
      <div className="relative z-20 mx-auto my-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-8 px-6 pt-4 pb-28 sm:px-12 sm:pb-32 lg:grid-cols-12 lg:gap-6 lg:px-16">
        {/* Columna Izquierda: Indicador vertical de progreso + Textos principales */}
        <div className="flex items-stretch gap-5 sm:gap-7 lg:col-span-6">
          {/* Rail vertical con dots interactivos */}
          <div
            className="hidden select-none flex-col items-center justify-between py-2 sm:flex"
            aria-label="Progreso del carrusel"
          >
            <span className="text-xs font-bold tracking-widest text-sky-300">
              {pad2(currentSlide + 1)}
            </span>
            <div className="relative my-3 flex flex-1 w-[2px] flex-col items-center justify-between rounded-full bg-white/20 py-1">
              {SLIDES_DATA.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Ir a diapositiva ${idx + 1}`}
                  onClick={() => goToSlide(idx)}
                  className={`cursor-pointer rounded-full transition-all ${
                    idx === currentSlide
                      ? 'h-3.5 w-3.5 bg-sky-400 ring-4 ring-sky-400/30'
                      : 'h-2 w-2 bg-white/45 hover:bg-white'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold tracking-widest text-white/50">
              {pad2(totalSlides)}
            </span>
          </div>

          {/* Bloque de texto con alto contraste */}
          <div className="max-w-xl space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-sky-200 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              <span>{currentItem.tag}</span>
            </div>

            <h1 className="text-3xl font-black leading-[1.08] tracking-tight text-white drop-shadow-sm sm:text-5xl xl:text-[54px]">
              {currentItem.title}
              <br />
              <span className="text-sky-300">{currentItem.highlight}</span>
            </h1>

            <p className="max-w-lg text-sm font-normal leading-relaxed text-slate-200/95 sm:text-base">
              {currentItem.desc}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#1D63ED] px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-500"
              >
                <span>{currentItem.cta}</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={goNext}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
              >
                <span>Siguiente vista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjetas preview + Controles de carrusel */}
        <div className="flex flex-col items-start justify-center space-y-4 lg:col-span-6 lg:items-end">
          {/* Deck de tarjetas horizontales interactivas */}
          <div
            id="carouselCardsDeck"
            className="flex w-full items-stretch gap-4 overflow-x-auto pb-2 lg:justify-end"
          >
            {previewCards.map(({ item, targetIdx, isNext }) => (
              <button
                key={targetIdx}
                type="button"
                onClick={() => goToSlide(targetIdx)}
                className={`group relative h-56 w-40 flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl text-left transition-all duration-300 sm:h-64 sm:w-48 border ${
                  isNext
                    ? 'border-sky-300/70 shadow-2xl shadow-sky-950/60 scale-[1.02]'
                    : 'border-white/20 opacity-85 hover:border-white/50 hover:opacity-100'
                }`}
              >
                <img
                  src={item.image}
                  alt={item.cardTitle}
                  onError={(e) => {
                    if (item.fallbackImage && e.currentTarget.src !== item.fallbackImage) {
                      e.currentTarget.src = item.fallbackImage
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-slate-950/20" />
                <div className="absolute top-3 right-3 left-3 flex items-center justify-between">
                  <span className="rounded-md border border-white/15 bg-slate-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-300 backdrop-blur-md">
                    {pad2(targetIdx + 1)}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-slate-900 shadow">
                    ↗
                  </span>
                </div>
                <div className="absolute right-3.5 bottom-3.5 left-3.5">
                  <p className="truncate text-[11px] font-medium text-sky-200/90">{item.cardSub}</p>
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-white">
                    {item.cardTitle}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Barra de controles: Flechas + Barra de progreso + Contador */}
          <div className="flex w-full max-w-md items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Diapositiva anterior"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/25"
              >
                ←
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Siguiente diapositiva"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/30"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => setAutoAdvance(!autoAdvance)}
                className="cursor-pointer rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/20"
              >
                {autoAdvance ? 'Auto: Activo' : 'Auto: Pausado'}
              </button>
            </div>

            {/* Línea de progreso de la diapositiva */}
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                ref={progressBarRef}
                className="h-full w-0 bg-sky-400 transition-all duration-100"
              />
            </div>

            <div className="tabular-nums text-xs font-bold tracking-wider text-white/90">
              <span>{pad2(currentSlide + 1)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span className="text-white/60">{pad2(totalSlides)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FRANJA PANORÁMICA DEL NADADOR EN EL BORDE INFERIOR (100% ancho de lado a lado) */}
      <SwimmerBar className="absolute bottom-0 left-0 right-0 z-30 m-0 h-[112px] w-full overflow-hidden p-0 pointer-events-none sm:h-[126px]" />
    </section>
  )
}
