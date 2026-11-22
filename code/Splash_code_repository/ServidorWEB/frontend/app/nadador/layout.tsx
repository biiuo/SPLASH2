import type { Metadata } from 'next'

import { ConSesion } from '@/components/con-sesion'
import { ShellNadador } from '@/components/nadador/shell'

export const metadata: Metadata = {
  title: 'Nadador · SafeSplash',
}

/** Todo /nadador/* pide la sesión iniciada como nadador (quien controla los permisos de verdad es el backend). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ConSesion roles={['nadador']}>
      <ShellNadador>{children}</ShellNadador>
    </ConSesion>
  )
}
