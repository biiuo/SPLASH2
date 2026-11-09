'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { GrupoPanel } from '@/components/grupo-panel'
import { HistorialSesiones } from '@/components/historial-sesiones'
import { SesionPanel } from '@/components/sesion-panel'
import { ErrorApi, api } from '@/lib/api'
import { NOMBRE_ROL, puedeCalibrar, useCuenta } from '@/lib/cuenta'
import type { Usuario } from '@/lib/tipos'
import {
  Activity,
  ArrowRight,
  Gauge,
  LayoutDashboard,
  LogIn,
  Menu,
  Play,
  Settings2,
  ShieldCheck,
  Timer,
  Trophy,
  Waves,
  X,
} from 'lucide-react'

// Todo lo que se muestra con números sale de la base de datos (a través del backend). No hay datos de ejemplo.

export function SafeSplashApp() {
  const cuenta = useCuenta()
  const [view, setView] = useState<'home' | 'login' | 'signup' | 'panel'>('home')
  const [menuOpen, setMenuOpen] = useState(false)

  // /?ingresar (por ejemplo, al entrar a una página que pide sesión) abre directamente el ingreso
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('ingresar')) setView('login')
    } catch {
      /* sin URL: se queda en el inicio */
    }
  }, [])

  // con la sesión iniciada se va al panel; si la sesión se cierra (o vence), vuelve al inicio
  useEffect(() => {
    if (cuenta.cargando) return
    if (cuenta.usuario && (view === 'login' || view === 'signup')) setView('panel')
    if (!cuenta.usuario && view === 'panel') setView('home')
  }, [cuenta.usuario, cuenta.cargando, view])

  if (view === 'login' || view === 'signup') {
    return <AuthScreen mode={view} onBack={() => setView('home')} onSignup={() => setView('signup')} onLogin={() => setView('login')} />
  }

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
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-blue-50 blur-3xl" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <button onClick={() => setView('home')} className="flex items-center gap-2.5" aria-label="Ir al inicio">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200"><Waves className="size-5" /></span>
          <span className="text-xl font-bold tracking-tight">Safe<span className="text-blue-600">Splash</span></span>
        </button>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-500 md:flex"><a href="#como-funciona" className="transition hover:text-blue-600">Cómo funciona</a>{cuenta.usuario ? <button onClick={entrar} className="rounded-full bg-blue-600 px-5 py-2.5 text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">Ir a mi panel · {cuenta.usuario.nombre} <ArrowRight className="ml-1 inline size-4" /></button> : <><button onClick={() => setView('login')} className="rounded-full px-4 py-2 text-slate-700 transition hover:bg-blue-50">Iniciar sesión</button><button onClick={() => setView('signup')} className="rounded-full bg-blue-600 px-5 py-2.5 text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">Crear cuenta <ArrowRight className="ml-1 inline size-4" /></button></>}</nav>
        <button className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú"><Menu className="size-5" /></button>
      </header>
      {menuOpen && <div className="relative z-20 mx-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl md:hidden">{cuenta.usuario ? <button onClick={entrar} className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white">Ir a mi panel</button> : <><button onClick={() => setView('login')} className="py-2 text-left text-sm font-medium">Iniciar sesión</button><button onClick={() => setView('signup')} className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white">Crear cuenta</button></>}</div>}

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><span className="size-1.5 rounded-full bg-blue-500" /> Tecnología para nadar mejor</div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] text-slate-950 sm:text-6xl">Cada largo cuenta.<br /><span className="text-blue-600">Tu progreso, también.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">Entrena con confianza. SafeSplash registra tus tiempos, velocidad y evolución para que puedas enfocarte en superar tu mejor marca.</p>
          <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => (cuenta.usuario ? entrar() : setView('signup'))} className="rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">Comenzar a entrenar <ArrowRight className="ml-2 inline size-4" /></button><button onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">Cómo funciona</button></div>
          <div className="mt-10 flex items-center gap-6 text-sm text-slate-500"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-blue-600" /> Datos protegidos</div><div className="flex items-center gap-2"><Activity className="size-4 text-blue-600" /> Métricas precisas</div></div>
        </div>
        <div className="relative mx-auto w-full max-w-xl"><div className="absolute -right-6 -top-8 size-28 rounded-full bg-sky-100 blur-2xl" /><div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-[#eaf6ff] p-4 shadow-2xl shadow-blue-100 sm:p-6"><div className="rounded-[1.4rem] bg-gradient-to-br from-[#1484d4] to-[#0757a0] p-6 text-white"><p className="text-sm text-blue-100">Lo que mide SafeSplash</p><p className="mt-1 text-2xl font-semibold">Sin cronómetro, sin sensores</p><p className="mt-4 text-sm leading-6 text-blue-100">Una cámara sobre la piscina sigue a cada nadador en su carril y calcula sus tiempos al pasar por cada marca.</p></div><div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-white p-4"><Timer className="size-4 text-blue-600" /><p className="mt-3 text-sm font-semibold">Tiempo por tramo</p></div><div className="rounded-2xl bg-white p-4"><Gauge className="size-4 text-blue-600" /><p className="mt-3 text-sm font-semibold">Velocidad</p></div><div className="rounded-2xl bg-white p-4"><Waves className="size-4 text-blue-600" /><p className="mt-3 text-sm font-semibold">Largos y descansos</p></div></div></div></div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Simple y preciso</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tu entrenamiento,<br />más inteligente.</h2><p className="mt-4 max-w-md leading-7 text-slate-500">La cámara y nuestro sistema de visión computacional convierten cada sesión en información útil para mejorar.</p></div><div className="grid gap-4 sm:grid-cols-3"><Step number="01" icon={LogIn} title="Crea tu cuenta" copy="Regístrate como nadador o entrenador." /><Step number="02" icon={Play} title="Nada" copy="Tu entrenador inicia la sesión y la cámara mide cada carril." /><Step number="03" icon={Trophy} title="Mide tu progreso" copy="Tiempos y velocidades por tramo, guardados en la base de datos." /></div></div></section>
      <footer className="border-t border-slate-100 px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-slate-700">Safe<span className="text-blue-600">Splash</span></span><span>Entrena mejor. Nada seguro.</span></div></footer>
    </main>
  )
}

function Step({ number, icon: Icon, title, copy }: { number: string; icon: typeof Activity; title: string; copy: string }) { return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-600">{number}</span><Icon className="size-5 text-blue-600" /></div><h3 className="mt-7 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p></div> }

const CAMPO = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'

function AuthScreen({ mode, onBack, onSignup, onLogin }: { mode: 'login' | 'signup'; onBack: () => void; onSignup: () => void; onLogin: () => void }) {
  const isLogin = mode === 'login'
  const cuenta = useCuenta()
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<'nadador' | 'entrenador'>('nadador')
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErrores([])
    try {
      if (isLogin) await cuenta.ingresar(email, contrasena)
      else await cuenta.registrarse({ email, nombre, contrasena, rol })
    } catch (err) {
      setErrores(err instanceof ErrorApi ? (err.detalles.length > 0 ? err.detalles : [err.message]) : ['No se pudo conectar con el servidor.'])
    } finally {
      setEnviando(false)
    }
  }

  return <main className="flex min-h-screen bg-slate-50"><div className="hidden flex-1 flex-col justify-between bg-blue-600 p-10 text-white lg:flex"><button onClick={onBack} className="flex items-center gap-2 text-lg font-bold"> <span className="flex size-9 items-center justify-center rounded-xl bg-white/15"><Waves className="size-5" /></span>Safe<span className="text-blue-200">Splash</span></button><div><Waves className="mb-5 size-12 text-blue-200" /><h1 className="max-w-md text-5xl font-semibold leading-tight">Nadar es avanzar.</h1><p className="mt-5 max-w-sm leading-7 text-blue-100">Tus datos, tu ritmo y un entrenador que te acompaña en cada largo.</p></div><p className="text-sm text-blue-200">© 2026 SafeSplash</p></div><div className="flex flex-1 items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md"><button onClick={onBack} className="mb-10 flex items-center gap-2 text-sm text-slate-500 lg:hidden"><X className="size-4" /> Volver al inicio</button><div className="mb-8 lg:hidden"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Waves className="size-5" /></span></div><p className="text-sm font-semibold uppercase tracking-wider text-blue-600">SafeSplash</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2><p className="mt-2 text-slate-500">{isLogin ? 'Continúa con tu próximo entrenamiento.' : 'Empieza a medir cada largo de tu progreso.'}</p>
    <form onSubmit={enviar} className="mt-8 flex flex-col gap-4">
      {!isLogin && <label className="text-sm font-medium text-slate-700">Nombre completo<input required value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="name" placeholder="Tu nombre" className={CAMPO} /></label>}
      <label className="text-sm font-medium text-slate-700">Correo electrónico<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@email.com" className={CAMPO} /></label>
      <label className="text-sm font-medium text-slate-700">Contraseña<input required type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={isLogin ? '••••••••' : 'Al menos 8 caracteres'} className={CAMPO} /></label>
      {!isLogin && <fieldset className="text-sm font-medium text-slate-700"><legend>Soy</legend><div className="mt-2 grid grid-cols-2 gap-2">{(['nadador', 'entrenador'] as const).map((r) => <label key={r} className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 transition ${rol === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}><input type="radio" name="rol" value={r} checked={rol === r} onChange={() => setRol(r)} className="sr-only" />{NOMBRE_ROL[r]}</label>)}</div></fieldset>}
      {errores.length > 0 && <ul role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button type="submit" disabled={enviando} className="mt-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-60">{enviando ? 'Un momento…' : isLogin ? 'Iniciar sesión' : 'Crear mi cuenta'} <ArrowRight className="ml-1 inline size-4" /></button>
    </form>
    <p className="mt-8 text-center text-sm text-slate-500">{isLogin ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button onClick={isLogin ? onSignup : onLogin} className="font-semibold text-blue-600 hover:underline">{isLogin ? 'Regístrate' : 'Inicia sesión'}</button></p></div></div></main>
}

const iniciales = (nombre: string) => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
const hoy = () => new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function DashboardShell({ children, usuario, onHome, onSalir }: { children: React.ReactNode; usuario: Usuario; onHome: () => void; onSalir: () => void }) {
  const esEntrenador = puedeCalibrar(usuario)
  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
      <button onClick={onHome} className="flex items-center gap-2.5 px-2"><span className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Waves className="size-5" /></span><span className="font-bold">Safe<span className="text-blue-600">Splash</span></span></button>
      <div className="mt-12 flex flex-1 flex-col gap-1"><span className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm font-medium text-blue-700"><LayoutDashboard className="size-4" />Resumen</span></div>
      <div className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{iniciales(usuario.nombre)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{usuario.nombre}</p><p className="text-xs text-slate-400">{NOMBRE_ROL[usuario.rol]}</p></div><Settings2 className="ml-auto size-4 text-slate-400" /></div><button onClick={onSalir} className="mt-3 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cerrar sesión</button></div>
    </aside>
    <div className="lg:pl-64">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><div><p className="text-sm capitalize text-slate-400">{hoy()}</p><h1 className="mt-1 text-xl font-semibold">{esEntrenador ? 'Panel de entrenador' : `Hola, ${usuario.nombre.split(' ')[0]}`}</h1></div><div className="flex items-center gap-3"><button onClick={onSalir} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 lg:hidden">Salir</button><button onClick={onHome} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Volver al inicio"><X className="size-4" /></button></div></header>
      <div className="p-5 sm:p-8">{children}</div>
    </div>
  </main>
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
  return <div className="mx-auto max-w-6xl">
    <div className="mb-8"><p className="text-sm font-semibold text-blue-600">Tu resumen</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Tu progreso en el agua</h2>
      <p className="mt-2 text-sm text-slate-500">
        {grupos === undefined ? '' : grupos.length ? `Tus grupos: ${grupos.map((g) => `${g.nombre} (${g.entrenador})`).join(' · ')}` : 'Todavía no estás en ningún grupo. Igual podés sumarte a las sesiones libres de un entrenador.'}
      </p></div>
    <SesionPanel titulo="Tu sesión" vacia="No tenés una sesión en curso. Elegí un carril: podés sumarte a la sesión de un entrenador (de tu grupo, o libre) o empezar una sesión personal." />
    <HistorialSesiones />
  </div>
}

/** Entrenador o administrador: calibración, la sesión en curso y el historial, todo desde la base. */
function TrainerDashboard() {
  return <div className="mx-auto max-w-6xl">
    <div className="mb-8"><p className="text-sm font-semibold text-blue-600">Vista general</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Entrenamiento</h2></div>
    <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-800">Calibración del sistema</p><p className="mt-1 text-sm text-blue-700">Antes de la primera sesión, o si se mueve la cámara o el zoom.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/configuracion" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100">Piscina y cámara</Link><Link href="/calibracion" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100">Calibrar la homografía</Link><Link href="/zonas" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100">Zonas de análisis</Link><Link href="/calibracion/historial" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100">Calibraciones guardadas</Link></div></div>
    <SesionPanel />
    <GrupoPanel />
    <HistorialSesiones />
  </div>
}
