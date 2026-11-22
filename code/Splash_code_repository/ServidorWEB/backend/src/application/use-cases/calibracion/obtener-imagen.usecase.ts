import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { NoEncontradoException } from '../../exceptions/aplicacion.exceptions'

/** La imagen (JPEG) sobre la que se calibró una posición de la cámara. */
export class ObtenerImagenCalibracionUseCase {
  constructor(private readonly calibraciones: CalibracionRepository) {}

  async execute(id: string): Promise<Uint8Array> {
    const imagen = esUuid(id) ? await this.calibraciones.obtenerImagen(id) : null
    if (!imagen) throw new NoEncontradoException('Esa calibración no tiene imagen guardada.')
    return imagen
  }
}
