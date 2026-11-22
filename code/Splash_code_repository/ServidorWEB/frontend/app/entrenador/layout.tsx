import type { Metadata } from 'next'

import { ConSesion } from '@/components/con-sesion'
import { ShellEntrenador } from '@/components/entrenador/shell-entrenador'

export const metadata: Metadata = {
  title: 'Entrenador · SafeSplash',
}

/**
 * Todo /entrenador/* pide la sesión iniciada como entrenador. Ve solo lo de sus nadadores (sus grupos) y sus
 * sesiones; no configura cámaras ni maneja cuentas: eso lo vuelve a comprobar el backend en cada pedido.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ConSesion roles={['entrenador']}>
      <ShellEntrenador>{children}</ShellEntrenador>
    </ConSesion>
  )
}
