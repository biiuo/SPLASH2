import type { ResumenSesion } from '../../../domain/entities/sesion.entity'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { ValidacionException } from '../../exceptions/aplicacion.exceptions'

export const LIMITE_POR_DEFECTO = 20
export const LIMITE_MAXIMO = 100

/** Historial: las últimas sesiones con el resumen de lo medido (carriles, tramos, distancia, velocidad media). */
export class ListarSesionesUseCase {
  constructor(private readonly sesiones: SesionRepository) {}

  execute(limite?: unknown, visiblePara: string | null = null): Promise<ResumenSesion[]> {
    const n = limite === undefined || limite === '' ? LIMITE_POR_DEFECTO : Number(limite)
    if (!Number.isInteger(n) || n < 1 || n > LIMITE_MAXIMO) {
      throw new ValidacionException(`limite tiene que ser un entero entre 1 y ${LIMITE_MAXIMO}.`)
    }
    return this.sesiones.listarRecientes(n, visiblePara)
  }
}
