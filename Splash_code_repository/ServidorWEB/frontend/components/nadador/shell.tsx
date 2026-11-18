'use client'

import { Bell, ChartNoAxesCombined, History, LayoutDashboard, LogOut, Menu, UserRound, Waves, X, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { useCuenta } from '@/lib/cuenta'
import { api } from '@/lib/api'

export type OpcionMenu = { href: string; texto: string; icono: LucideIcon }

const OPCIONES_NADADOR: OpcionMenu[] = [
  { href: '/nadador', texto: 'Mi resumen', icono: LayoutDashboard },
  { href: '/nadador/progreso', texto: 'Mi progreso', icono: ChartNoAxesCombined },
  { href: '/nadador/sesiones', texto: 'Mis sesiones', icono: History },
  { href: '/nadador/perfil', texto: 'Mi perfil', icono: UserRound },
]

export const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

/** El marco del módulo del nadador. El cuestionario inicial (/nadador/bienvenida) va a pantalla completa, sin menú. */
export function ShellNadador({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  if (ruta.startsWith('/nadador/bienvenida')) return <>{children}</>
  return <ShellModulo opciones={OPCIONES_NADADOR} rol="Nadador">{children}</ShellModulo>
}

/**
 * El marco de un módulo con sesión iniciada: menú lateral azul marino (como la portada) con el color de acento del
 * rol, el usuario abajo y el contenido sobre fondo claro. En el celular, el menú va arriba y se despliega.
 */
export function ShellModulo({ opciones, rol, children }: { opciones: OpcionMenu[]; rol: string; children: React.ReactNode }) {
  const ruta = usePathname()
  const router = useRouter()
  const cuenta = useCuenta()
  const [abierto, setAbierto] = useState(false)
  const botonMenu = useRef<HTMLButtonElement>(null)
  const idMenu = useId()
  const [solicitudes, setSolicitudes] = useState(0)
  useEffect(() => {
    if (rol !== 'Administrador') return
    let vivo = true
    const cargar = () => {
      void api.adminSolicitudesEntrenador()
        .then((r) => { if (vivo) setSolicitudes(r.total) })
        .catch((error: unknown) => { if (vivo) console.error('No se pudieron cargar las solicitudes de entrenadores:', error) })
    }
    cargar()
    const intervalo = window.setInterval(cargar, 30000)
    return () => {
      vivo = false
      window.clearInterval(intervalo)
    }
  }, [rol])
  const inicio = opciones[0]?.href ?? '/'
  const activa = (href: string) => (href === inicio ? ruta === href : ruta.startsWith(href))
  const tema = rol === 'Nadador' ? 'nadador' : rol === 'Entrenador' ? 'entrenador' : 'administrador'

  useEffect(() => {
    if (!abierto) return
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      setAbierto(false)
      botonMenu.current?.focus()
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [abierto])

  async function salir() {
    await cuenta.salir()
    router.push('/')
  }

  const logo = (
    <Link href="/" aria-label="SafeSplash, volver al inicio" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#1D63ED] text-white shadow-lg shadow-[#1D63ED]/40"><Waves className="size-5" /></span>
      <span className="font-bold text-white">Safe<span className="text-[#7DD3FC]">Splash</span></span>
    </Link>
  )

  const menu = (
    <nav className="flex flex-col gap-1" aria-label={`Módulo ${rol.toLowerCase()}`}>
      {opciones.map(({ href, texto, icono: Icono }) => {
        const on = activa(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setAbierto(false)}
            aria-current={on ? 'page' : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              on ? 'bg-white/10 text-white ring-1 ring-white/15' : 'text-sky-100/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {on && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--acento-2)]" aria-hidden="true" />}
            <Icono className={`size-4 ${on ? 'text-[var(--acento-2)]' : 'text-sky-300/70 group-hover:text-sky-200'}`} />
            {texto}
          </Link>
        )
      })}
    </nav>
  )

  const usuario = cuenta.usuario
  const pie = usuario && (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--acento)] to-[var(--acento-2)] text-sm font-semibold text-white">{iniciales(usuario.nombre)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p>
          <p className="text-xs text-sky-200/70">{rol}</p>
        </div>
      </div>
      <button onClick={salir} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 py-2 text-xs font-semibold text-sky-100 transition hover:bg-white/10">
        <LogOut className="size-3.5" /> Cerrar sesión
      </button>
    </div>
  )

  return (
    <div data-tema={tema} className="panel-fondo min-h-screen text-[#0F172A]">
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] flex-col overflow-hidden bg-gradient-to-b from-[var(--marino-1)] via-[var(--marino-2)] to-[var(--marino-1)] p-4 lg:flex">
        {/* las ondas del fondo, como en la portada */}
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-60" viewBox="0 0 220 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 60 C 50 40, 90 80, 140 60 S 200 40, 220 55 V160 H0 Z" fill="var(--acento)" fillOpacity="0.18" />
          <path d="M0 90 C 60 70, 110 110, 160 90 S 210 75, 220 88 V160 H0 Z" fill="var(--acento-2)" fillOpacity="0.12" />
        </svg>
        <div className="relative mb-8 flex items-center justify-between px-2">
          {logo}
          {rol === 'Administrador' && (
            <Link href="/admin/entrenadores" className="relative flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-100 transition hover:bg-white/10" aria-label="Solicitudes de entrenadores">
              <Bell className="size-4" />
              {solicitudes > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">{solicitudes > 99 ? '99+' : solicitudes}</span>}
            </Link>
          )}
        </div>
        <div className="relative flex-1 overflow-y-auto">{menu}</div>
        <div className="relative">{pie}</div>
      </aside>

      {/* celular / tablet: barra arriba con el menú desplegable */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--marino-1)] px-4 py-3 lg:hidden">
        {logo}
        <div className="flex items-center gap-1">
          {rol === 'Administrador' && (
            <Link href="/admin/entrenadores" className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sky-100 hover:bg-white/10" aria-label="Solicitudes de entrenadores">
              <Bell className="size-5" />
              {solicitudes > 0 && <span className="absolute right-0 top-0 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-bold text-white">{solicitudes > 99 ? '99+' : solicitudes}</span>}
            </Link>
          )}
          <button ref={botonMenu} onClick={() => setAbierto(!abierto)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-sky-100 hover:bg-white/10" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierto} aria-controls={idMenu}>
            {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>
      <div id={idMenu} hidden={!abierto}>
        {abierto && (
        <div className="sticky top-[60px] z-20 flex flex-col gap-3 bg-[var(--marino-2)] p-4 shadow-xl lg:hidden">
          {menu}
          {pie}
        </div>
        )}
      </div>

      <main className="lg:pl-[220px]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  )
}

/** Encabezado de cada página del módulo. */
export function Encabezado({ titulo, bajada, accion }: { titulo: string; bajada?: string; accion?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">{titulo}</h1>
        {bajada && <p className="mt-1 text-sm text-[#64748B]">{bajada}</p>}
      </div>
      {accion}
    </div>
  )
}
