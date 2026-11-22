import type { CalibracionGuardada } from '../../../domain/entities/calibracion.entity'
import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'

export class ObtenerCalibracionActivaUseCase {
  constructor(private readonly calibraciones: CalibracionRepository) {}

  /** La calibración activa, o null si todavía no hay ninguna. */
  execute(): Promise<CalibracionGuardada | null> {
    return this.calibraciones.obtenerActiva()
  }
}
