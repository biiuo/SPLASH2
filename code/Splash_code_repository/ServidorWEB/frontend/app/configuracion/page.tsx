import type { Metadata } from 'next'

import { ConSesion } from '@/components/con-sesion'
import { ConfiguracionEditor } from '@/features/configuracion'

export const metadata: Metadata = {
  title: 'Configuración · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['administrador']}>
      <ConfiguracionEditor />
    </ConSesion>
  )
}
