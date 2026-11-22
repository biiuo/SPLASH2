import type { ArchivoZonas } from '../../../domain/entities/calibracion.entity'
import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { NoEncontradoException } from '../../exceptions/aplicacion.exceptions'

/**
 * Las zonas de una calibración en el formato de zones.json. Es lo que pide el servidor de IA al unirse a una sesión
 * (con el calibracion_id de la sesión). null si la calibración todavía no tiene zonas.
 */
export class ObtenerZonasUseCase {
  constructor(private readonly calibraciones: CalibracionRepository) {}

  async execute(id: string): Promise<ArchivoZonas | null> {
    const c = esUuid(id) ? await this.calibraciones.obtener(id) : null
    if (!c) throw new NoEncontradoException('No existe esa calibración.')
    return c.zonas && c.zonas.length > 0 ? { image_size: c.image_size, zones: c.zonas } : null
  }
}
