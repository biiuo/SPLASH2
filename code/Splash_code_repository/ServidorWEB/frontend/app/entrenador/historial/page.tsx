'use client'

import { ListaSesiones } from '@/features/historial'

export default function HistorialEntrenador() {
  return (
    <ListaSesiones
      base="/entrenador/historial"
      titulo="Historial de sesiones"
      bajada="Las sesiones que iniciaste, con los registros detectados y estimados. Abrí una para ver sus gráficas y el tiempo de cada largo."
    />
  )
}
