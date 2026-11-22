'use client'

import { Activity, BarChart3, LayoutDashboard, MonitorPlay, Settings2, ShieldCheck, UserCog, Users } from 'lucide-react'

import { type OpcionMenu, ShellModulo } from '@/components/nadador/shell'

const OPCIONES_ADMIN: OpcionMenu[] = [
  { href: '/admin', texto: 'Dashboard', icono: LayoutDashboard },
  { href: '/admin/nadadores', texto: 'Nadadores', icono: Users },
  { href: '/admin/entrenadores', texto: 'Entrenadores', icono: UserCog },
  { href: '/admin/sesiones', texto: 'Sesiones', icono: Activity },
  { href: '/admin/monitoreo', texto: 'Monitoreo en tiempo real', icono: MonitorPlay },
  { href: '/admin/reportes', texto: 'Reportes y estadísticas', icono: BarChart3 },
  { href: '/admin/usuarios', texto: 'Usuarios y permisos', icono: ShieldCheck },
  { href: '/admin/configuracion', texto: 'Configuración', icono: Settings2 },
]

/** El marco del módulo del administrador (el mismo diseño que el del nadador). */
export function ShellAdmin({ children }: { children: React.ReactNode }) {
  return <ShellModulo opciones={OPCIONES_ADMIN} rol="Administrador">{children}</ShellModulo>
}
