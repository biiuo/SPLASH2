'use client'

import { calibracionesApi } from '@/infrastructure/api/calibraciones'
import { CalibracionesGuardadas } from './components/calibraciones-guardadas'

/** Conecta el puerto de la pantalla con el adaptador de la aplicación. */
export function CalibracionesGuardadasConApi() {
  return <CalibracionesGuardadas puerto={calibracionesApi} />
}
