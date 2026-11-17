'use client'

import { ChartNoAxesCombined, FileText, GitCompareArrows, History, LayoutDashboard, MonitorPlay, Target, UserRound, Users } from 'lucide-react'

import { type OpcionMenu, ShellModulo } from '@/components/nadador/shell'

const OPCIONES_ENTRENADOR: OpcionMenu[] = [
  { href: '/entrenador', texto: 'Dashboard', icono: LayoutDashboard },
  { href: '/entrenador/nadadores', texto: 'Mis nadadores', icono: Users },
  { href: '/entrenador/monitoreo', texto: 'Monitoreo', icono: MonitorPlay },
  { href: '/entrenador/rendimiento', texto: 'Rendimiento', icono: ChartNoAxesCombined },
  { href: '/entrenador/comparaciones', texto: 'Comparaciones', icono: GitCompareArrows },
  { href: '/entrenador/objetivos', texto: 'Objetivos', icono: Target },
  { href: '/entrenador/historial', texto: 'Historial', icono: History },
  { href: '/entrenador/reportes', texto: 'Reportes', icono: FileText },
  { href: '/entrenador/perfil', texto: 'Mi perfil', icono: UserRound },
]

/** El marco del módulo del entrenador (mismo diseño que el del nadador y el del administrador). */
export function ShellEntrenador({ children }: { children: React.ReactNode }) {
  return <ShellModulo opciones={OPCIONES_ENTRENADOR} rol="Entrenador">{children}</ShellModulo>
}

