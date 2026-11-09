import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import { aArchivoCalibracion, evaluar, geometriaDe } from '../../../domain/services/evaluador-calibracion'
import { invertir } from '../../../domain/services/homografia'
import type { EvaluarCalibracionEntrada, ResultadoEvaluacionDto } from '../../dtos/calibracion.dto'
import { configuracionEfectiva } from '../configuracion/configuracion-efectiva'
import { validarCuerdas, validarMarcas, validarTamanoImagen } from './validar-entrada'

/** Evalúa los puntos marcados hasta ahora: cuántos faltan, qué tan buena es la calibración y cuál es el siguiente punto. */
export class EvaluarCalibracionUseCase {
  constructor(private readonly configuracion: ConfiguracionRepository) {}

  async execute(entrada: EvaluarCalibracionEntrada): Promise<ResultadoEvaluacionDto> {
    const { marcas, omitidos } = validarMarcas(entrada?.marcas, entrada?.omitidos)
    const geometria = geometriaDe((await configuracionEfectiva(this.configuracion)).piscina)
    const cuerdas = validarCuerdas(entrada?.cuerdas, geometria)

    const tam = entrada?.image_size !== undefined ? validarTamanoImagen(entrada.image_size) : undefined
    const evaluacion = evaluar(marcas, omitidos, geometria, cuerdas, tam)
    const archivo = evaluacion.H && tam ? aArchivoCalibracion(marcas, tam[0], tam[1], omitidos, geometria, cuerdas) : null
    return { evaluacion: { ...evaluacion, Hinv: evaluacion.H ? invertir(evaluacion.H) : null }, archivo }
  }
}
