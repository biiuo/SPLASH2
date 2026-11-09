import type { Metadata } from 'next'

import { ConSesion } from '@/components/con-sesion'
import { ConfiguracionEditor } from '@/components/configuracion-editor'

export const metadata: Metadata = {
  title: 'Configuración · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['entrenador', 'administrador']}>
      <ConfiguracionEditor />
    </ConSesion>
  )
}
