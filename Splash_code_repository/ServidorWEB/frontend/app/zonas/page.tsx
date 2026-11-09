import type { Metadata } from 'next'

import { ConSesion } from '@/components/con-sesion'
import { ZoneEditor } from '@/components/zone-editor'

export const metadata: Metadata = {
  title: 'Zonas de análisis · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['entrenador', 'administrador']}>
      <ZoneEditor />
    </ConSesion>
  )
}
