'use client'

import { ChartNoAxesCombined, History, LayoutDashboard, LogOut, Menu, UserRound, Waves, X, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCuenta } from '@/lib/cuenta'

export type OpcionMenu = { href: string; texto: string; icono: LucideIcon }

const OPCIONES_NADADOR: OpcionMenu[] = [
  { href: '/nadador', texto: 'Mi resumen', icono: LayoutDashboard },
  { href: '/nadador/progreso', texto: 'Mi progreso', icono: ChartNoAxesCombined },
  { href: '/nadador/sesiones', texto: 'Mis sesiones', icono: History },
  { href: '/nadador/perfil', texto: 'Mi perfil', icono: UserRound },
]

export const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

/** El marco del módulo del nadador. */
export function ShellNadador({ children }: { children: React.ReactNode }) {
  return <ShellModulo opciones={OPCIONES_NADADOR} rol="Nadador">{children}</ShellModulo>
}

/**
 * El marco de un módulo (nadador, administrador): menú lateral fijo de 220 px (en el celular, arriba y desplegable),
 * el usuario abajo con "Cerrar sesión", y el contenido. La primera opción es el inicio del módulo.
 */
export function ShellModulo({ opciones, rol, children }: { opciones: OpcionMenu[]; rol: string; children: React.ReactNode }) {
  const ruta = usePathname()
  const router = useRouter()
  const cuenta = useCuenta()
  const [abierto, setAbierto] = useState(false)
  const inicio = opciones[0]?.href ?? '/'
  const activa = (href: string) => (href === inicio ? ruta === href : ruta.startsWith(href))

  async function salir() {
    await cuenta.salir()
    router.push('/')
  }

  const menu = (
    <nav className="flex flex-col gap-1" aria-label={`Módulo ${rol.toLowerCase()}`}>
      {opciones.map(({ href, texto, icono: Icono }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setAbierto(false)}
          aria-current={activa(href) ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            activa(href) ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'text-[#64748B] hover:bg-[#F1F5F9]'
          }`}
        >
          <Icono className="size-4 text-[#2563EB]" />
          {texto}
        </Link>
      ))}
    </nav>
  )

  const usuario = cuenta.usuario
  const pie = usuario && (
    <div className="rounded-2xl bg-[#F8FAFC] p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-semibold text-[#1D4ED8]">{iniciales(usuario.nombre)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#0F172A]">{usuario.nombre}</p>
          <p className="text-xs text-[#94A3B8]">{rol}</p>
        </div>
      </div>
      <button onClick={salir} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#334155]">
        <LogOut className="size-3.5" /> Cerrar sesión
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] flex-col overflow-y-auto border-r border-[#E2E8F0] bg-white p-4 lg:flex">
        <Link href={inicio} className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#2563EB] text-white"><Waves className="size-5" /></span>
          <span className="font-bold">Safe<span className="text-[#2563EB]">Splash</span></span>
        </Link>
        <div className="flex-1">{menu}</div>
        {pie}
      </aside>

      {/* celular / tablet: barra arriba con el menú desplegable */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3 lg:hidden">
        <Link href={inicio} className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB] text-white"><Waves className="size-4" /></span>
          <span className="font-bold">Safe<span className="text-[#2563EB]">Splash</span></span>
        </Link>
        <button onClick={() => setAbierto(!abierto)} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierto}>
          {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {abierto && (
        <div className="sticky top-[57px] z-20 flex flex-col gap-3 border-b border-[#E2E8F0] bg-white p-4 shadow-sm lg:hidden">
          {menu}
          {pie}
        </div>
      )}

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
