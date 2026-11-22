import type { Metadata } from 'next'

import { ConSesion } from '@/components/con-sesion'
import { ZoneEditor } from '@/features/zonas'
import { LimiteError } from '@/shared/ui/limite-error'

export const metadata: Metadata = {
  title: 'Zonas de análisis · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['administrador']}>
      <LimiteError>
        <ZoneEditor />
      </LimiteError>
    </ConSesion>
  )
}
