import type { Metadata } from 'next'

import { CalibracionEditor } from '@/components/calibracion-editor'
import { ConSesion } from '@/components/con-sesion'

export const metadata: Metadata = {
  title: 'Calibración · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['entrenador', 'administrador']}>
      <CalibracionEditor />
    </ConSesion>
  )
}
