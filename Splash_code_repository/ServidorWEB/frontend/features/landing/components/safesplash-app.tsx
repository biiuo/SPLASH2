'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { GrupoPanel } from '@/features/grupo'
import { HeroCarousel } from './hero-carousel'
import { HistorialSesiones } from '@/features/historial'
import { SesionPanel } from '@/features/sesion'
import { AuthScreen } from '@/features/cuenta'
import { api } from '@/lib/api'
import { NOMBRE_ROL, puedeCalibrar, useCuenta } from '@/lib/cuenta'
import type { Usuario } from '@/lib/tipos'
import { useParametroUrl } from '@/shared/hooks/use-parametro-url'
import {
  Activity,
  LayoutDashboard,
  LogIn,
  Play,
  Settings2,
  Trophy,
  Waves,
  X,
} from 'lucide-react'

// Todo lo que se muestra con números sale de la base de datos (a través del backend). No hay datos de ejemplo.

export function SafeSplashApp() {
  const cuenta = useCuenta()
  const ingresar = useParametroUrl('ingresar')
  const [vistaElegida, setView] = useState<'home' | 'login' | 'signup' | 'panel' | null>(null)
  const [destinoPanel, setDestinoPanel] = useState<string | null>(null)

  // /?ingresar (por ejemplo, al entrar a una página que pide sesión) abre directamente el ingreso
  const vistaSolicitada = vistaElegida ?? (ingresar !== null ? 'login' : 'home')
  // con la sesión iniciada se va al panel; si la sesión se cierra (o vence), vuelve al inicio
  const view = cuenta.cargando
    ? vistaSolicitada
    : cuenta.usuario && (vistaSolicitada === 'login' || vistaSolicitada === 'signup')
      ? 'panel'
      : !cuenta.usuario && vistaSolicitada === 'panel'
        ? 'home'
        : vistaSolicitada

  if (view === 'login' || view === 'signup') {
    return (
      <AuthScreen
        mode={view}
        onBack={() => setView('home')}
        onSignup={() => setView('signup')}
        onLogin={() => setView('login')}
        onRegistered={() => setDestinoPanel('/nadador/bienvenida')}
      />
    )
  }

  // cada rol con su módulo: /nadador, /entrenador y /admin, cada uno con su menú lateral
  if (view === 'panel' && cuenta.usuario?.rol === 'nadador') return <IrAlModulo a={destinoPanel ?? '/nadador'} />
  if (view === 'panel' && cuenta.usuario?.rol === 'administrador') return <IrAlModulo a="/admin" />
  if (view === 'panel' && cuenta.usuario?.rol === 'entrenador') return <IrAlModulo a="/entrenador" />

  if (view === 'panel' && cuenta.usuario) {
    const esEntrenador = puedeCalibrar(cuenta.usuario)
    return (
      <DashboardShell usuario={cuenta.usuario} onHome={() => setView('home')} onSalir={() => void cuenta.salir()}>
        {esEntrenador ? <TrainerDashboard /> : <UserDashboard />}
      </DashboardShell>
    )
  }

  const entrar = () => setView(cuenta.usuario ? 'panel' : 'login')

  return (
    <main className="overflow-x-hidden bg-white text-slate-950">
      {/* Hero Carrusel con Fotos Reales de Piscina + Franja Panorámica del Nadador (100% de lado a lado) */}
      <HeroCarousel
        usuario={cuenta.usuario}
        onLogin={() => setView('login')}
        onSignup={() => setView('signup')}
        onPanel={entrar}
        onExploreHowItWorks={() => {
          document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })
        }}
      />

      {/* Sección Cómo Funciona */}
      <section id="como-funciona" className="min-h-[100dvh] scroll-mt-0 bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-7xl items-center gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Simple y preciso</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Tu entrenamiento,<br />más inteligente.
            </h2>
            <p className="mt-4 max-w-md leading-7 text-slate-500">
              La cámara y nuestro sistema de visión computacional convierten cada sesión en información útil para mejorar.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Step number="01" icon={LogIn} title="Crea tu cuenta" copy="Regístrate como nadador o entrenador." />
            <Step number="02" icon={Play} title="Nada" copy="Tu entrenador inicia la sesión y la cámara mide cada carril." />
            <Step number="03" icon={Trophy} title="Mide tu progreso" copy="Tiempos y velocidades por tramo, guardados en la base de datos." />
          </div>
        </div>
      </section>

      {/* Sección informativa: tecnología */}
      <section className="min-h-[100dvh] scroll-mt-0 bg-slate-950 px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-7xl flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-400">Tecnología SafeSplash</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Seguimiento preciso en cada carril.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <FeatureCard number="01" title="Visión computacional" copy="Detecta a cada nadador y registra su recorrido sin sensores personales." />
            <FeatureCard number="02" title="Métricas claras" copy="Consulta velocidades, largos, tiempos y evolución por sesión." />
            <FeatureCard number="03" title="Trabajo coordinado" copy="Entrenadores y nadadores comparten información desde una sola plataforma." />
          </div>
        </div>
      </section>

      <footer className="min-h-24 border-t border-slate-100 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-slate-700">Safe<span className="text-blue-600">Splash</span></span>
          <span>Entrena mejor. Nada seguro. Universidad del Norte.</span>
        </div>
      </footer>

    </main>
  )
}

/** El nadador, el entrenador y el administrador tienen su propio módulo con menú lateral. */
function IrAlModulo({ a }: { a: string }) {
  const router = useRouter()
  useEffect(() => router.replace(a), [router, a])
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Abriendo tu panel…</main>
}

function Step({ number, icon: Icon, title, copy }: { number: string; icon: typeof Activity; title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-blue-600">{number}</span>
        <Icon className="size-5 text-blue-600" />
      </div>
      <h3 className="mt-7 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
    </div>
  )
}

function FeatureCard({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
      <span className="text-xs font-bold text-sky-400">{number}</span>
      <h3 className="mt-5 text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p>
    </article>
  )
}



const iniciales = (nombre: string) => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
const hoy = () => new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function DashboardShell({ children, usuario, onHome, onSalir }: { children: React.ReactNode; usuario: Usuario; onHome: () => void; onSalir: () => void }) {
  const esEntrenador = puedeCalibrar(usuario)
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
        <button onClick={onHome} className="flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Waves className="size-5" /></span>
          <span className="font-bold">Safe<span className="text-blue-600">Splash</span></span>
        </button>
        <div className="mt-12 flex flex-1 flex-col gap-1">
          <span className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm font-medium text-blue-700">
            <LayoutDashboard className="size-4" />Resumen
          </span>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{iniciales(usuario.nombre)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
              <p className="text-xs text-slate-400">{NOMBRE_ROL[usuario.rol]}</p>
            </div>
            <Settings2 className="ml-auto size-4 text-slate-400" />
          </div>
          <button onClick={onSalir} className="mt-3 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm capitalize text-slate-400">{hoy()}</p>
            <h1 className="mt-1 text-xl font-semibold">{esEntrenador ? 'Panel de entrenador' : `Hola, ${usuario.nombre.split(' ')[0]}`}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSalir} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 lg:hidden">Salir</button>
            <button onClick={onHome} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Volver al inicio"><X className="size-4" /></button>
          </div>
        </header>
        <div className="p-5 sm:p-8">{children}</div>
      </div>
    </main>
  )
}

/**
 * Nadador: solo lo suyo. Sus sesiones personales y las sesiones de entrenadores en las que tiene un carril (de uno de
 * sus grupos, o libres). En cada una ve solo su carril.
 */
function UserDashboard() {
  const [grupos, setGrupos] = useState<{ id: string; nombre: string; entrenador: string }[] | undefined>(undefined)
  useEffect(() => {
    api.misGruposComoNadador().then(setGrupos).catch(() => setGrupos([]))
  }, [])
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">Tu resumen</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Tu progreso en el agua</h2>
        <p className="mt-2 text-sm text-slate-500">
          {grupos === undefined ? '' : grupos.length ? `Tus grupos: ${grupos.map((g) => `${g.nombre} (${g.entrenador})`).join(' · ')}` : 'Todavía no estás en ningún grupo. Igual podés sumarte a las sesiones libres de un entrenador.'}
        </p>
      </div>
      <SesionPanel titulo="Tu sesión" vacia="No tenés una sesión en curso. Elegí un carril: podés sumarte a la sesión de un entrenador (de tu grupo, o libre) o empezar una sesión personal." />
      <HistorialSesiones />
    </div>
  )
}

/** Entrenador o administrador: calibración, la sesión en curso y el historial, todo desde la base. */
function TrainerDashboard() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">Vista general</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Entrenamiento</h2>
      </div>
      <SesionPanel />
      <GrupoPanel />
      <HistorialSesiones />
    </div>
  )
}
