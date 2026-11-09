// La configuración (piscina y cámara) la guarda el backend; esta función la trae para las pantallas que la necesitan.
import { useEffect, useState } from 'react'

import { api } from './api'
import type { ConfiguracionEfectiva } from './tipos'

/** La configuración en uso (la guardada o la de fábrica), o null mientras carga. `error` dice por qué no se pudo traer. */
export function useConfiguracion(): { efectiva: ConfiguracionEfectiva | null; error: string | null } {
  const [efectiva, setEfectiva] = useState<ConfiguracionEfectiva | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    api
      .configuracion()
      .then((c) => vigente && setEfectiva(c))
      .catch((e: Error) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [])

  return { efectiva, error }
}
