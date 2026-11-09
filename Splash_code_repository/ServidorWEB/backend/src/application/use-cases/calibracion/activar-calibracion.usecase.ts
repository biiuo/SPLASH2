import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { NoEncontradoException } from '../../exceptions/aplicacion.exceptions'

/** Deja una calibración ya guardada como la activa. Las sesiones nuevas usan esa; las que ya empezaron no cambian. */
export class ActivarCalibracionUseCase {
  constructor(private readonly calibraciones: CalibracionRepository) {}

  async execute(id: string): Promise<{ id: string }> {
    if (!esUuid(id) || !(await this.calibraciones.activar(id))) throw new NoEncontradoException('No existe esa calibración.')
    return { id }
  }
}
