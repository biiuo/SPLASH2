import { Configuracion } from '../../../domain/entities/configuracion.entity'
import type { AnalisisConfiguracionDto } from '../../dtos/configuracion.dto'
import { ValidacionException } from '../../exceptions/aplicacion.exceptions'

/** Analiza una configuración sin guardarla: sirve para mostrar, mientras se edita, qué implican los valores. */
export class AnalizarConfiguracionUseCase {
  execute(entrada: unknown): AnalisisConfiguracionDto {
    if (!entrada || typeof entrada !== 'object') throw new ValidacionException('La configuración tiene que ser un objeto JSON.')
    const configuracion = Configuracion.desde(entrada)
    const errores = configuracion.validar()
    if (errores.length > 0) return { errores, derivados: null, precision: [], avisos: [] }
    return {
      errores,
      derivados: configuracion.derivados(),
      precision: configuracion.precisionPorNodo(),
      avisos: configuracion.avisos(),
    }
  }
}
