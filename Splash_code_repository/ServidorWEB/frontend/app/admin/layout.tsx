import type { Metadata } from 'next'

import { ShellAdmin } from '@/components/admin/shell-admin'
import { ConSesion } from '@/components/con-sesion'

export const metadata: Metadata = {
  title: 'Administración · SafeSplash',
}

/** Todo /admin/* pide la sesión iniciada como administrador (el backend lo vuelve a comprobar en cada pedido). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ConSesion roles={['administrador']}>
      <ShellAdmin>{children}</ShellAdmin>
    </ConSesion>
  )
}
