'use client'

import { ListaSesiones } from '@/features/historial'

export default function SesionesAdmin() {
  return (
    <ListaSesiones
      base="/admin/sesiones"
      titulo="Sesiones"
      bajada="Todas las sesiones del sistema. Las marcadas con error terminaron sin datos o con más de la mitad de los tramos estimados."
    />
  )
}
