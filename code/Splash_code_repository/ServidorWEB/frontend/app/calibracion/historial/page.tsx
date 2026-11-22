import type { Metadata } from 'next'

import { CalibracionesGuardadas } from '@/features/calibracion'
import { ConSesion } from '@/components/con-sesion'

export const metadata: Metadata = {
  title: 'Posiciones de la cámara · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['administrador']}>
      <CalibracionesGuardadas />
    </ConSesion>
  )
}
