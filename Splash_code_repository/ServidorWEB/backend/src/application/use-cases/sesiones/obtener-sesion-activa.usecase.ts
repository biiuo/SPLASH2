import type { Sesion } from '../../../domain/entities/sesion.entity'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'

export class ObtenerSesionActivaUseCase {
  constructor(private readonly sesiones: SesionRepository) {}

  /** La sesión activa, o null si no hay ninguna. Con `visiblePara`, solo si esa persona puede verla. */
  execute(visiblePara: string | null = null): Promise<Sesion | null> {
    return this.sesiones.obtenerActiva(visiblePara)
  }
}
