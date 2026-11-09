import type { CalibracionRepository, CalibracionResumen } from '../../../domain/repositories/calibracion.repository'

/** Las calibraciones guardadas, para poder elegir una. */
export class ListarCalibracionesUseCase {
  constructor(private readonly calibraciones: CalibracionRepository) {}

  execute(): Promise<CalibracionResumen[]> {
    return this.calibraciones.listar()
  }
}
