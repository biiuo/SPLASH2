import type { PuertoAdministrarCalibraciones } from '@/features/calibracion/model/puerto-calibraciones'
import { ErrorApi, api } from '@/lib/api'

/** Adaptador de lectura que conserva el cliente y los contratos existentes. */
export const calibracionesApi: PuertoAdministrarCalibraciones = {
  listar: () => api.historialCalibraciones(),
  activar: (id) => api.activarCalibracion(id),
  desactivar: () => api.desactivarCalibracion(),
  eliminar: (id) => api.eliminarCalibracion(id),
  renombrar: (id, nombre) => api.actualizarCalibracion(id, { nombre }),
  mensajeError: (error, alternativa, incluirDetalles = false) =>
    error instanceof ErrorApi ? (incluirDetalles ? [error.message, ...error.detalles].join(' ') : error.message) : alternativa,
}
