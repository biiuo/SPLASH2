import type { CalibracionResumen } from '@/domain/calibracion/calibracion-resumen'

/** Operaciones de lectura que necesita la aplicación de calibración. */
export interface PuertoCalibraciones {
  listar(): Promise<CalibracionResumen[]>
}

/** Operaciones necesarias para administrar las posiciones guardadas. */
export interface PuertoAdministrarCalibraciones extends PuertoCalibraciones {
  activar(id: string): Promise<unknown>
  desactivar(): Promise<unknown>
  eliminar(id: string): Promise<unknown>
  renombrar(id: string, nombre: string | null): Promise<unknown>
  mensajeError(error: unknown, alternativa: string, incluirDetalles?: boolean): string
}
