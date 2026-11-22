import type { Metadata } from 'next'

import { CalibracionEditor } from '@/features/calibracion'
import { ConSesion } from '@/components/con-sesion'
import { LimiteError } from '@/shared/ui/limite-error'

export const metadata: Metadata = {
  title: 'Calibración · SafeSplash',
}

export default function Page() {
  return (
    <ConSesion roles={['administrador']}>
      <LimiteError>
        <CalibracionEditor />
      </LimiteError>
    </ConSesion>
  )
}
