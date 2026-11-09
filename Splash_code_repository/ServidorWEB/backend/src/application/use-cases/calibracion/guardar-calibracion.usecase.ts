import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import { aArchivoCalibracion, evaluar, geometriaDe } from '../../../domain/services/evaluador-calibracion'
import type { CalibracionGuardadaDto, GuardarCalibracionEntrada } from '../../dtos/calibracion.dto'
import { ValidacionException } from '../../exceptions/aplicacion.exceptions'
import { configuracionEfectiva } from '../configuracion/configuracion-efectiva'
import {
  validarCuerdas,
  validarImagen,
  validarLlegada,
  validarMarcas,
  validarNombre,
  validarTamanoImagen,
  validarZonas,
} from './validar-entrada'

/**
 * Guarda una calibración nueva (una posición de la cámara) y la deja activa. La homografía la calcula el servidor a
 * partir de los puntos: no se confía en una matriz que venga calculada desde afuera. Puede traer ya su nombre y sus zonas.
 */
export class GuardarCalibracionUseCase {
  constructor(
    private readonly configuracion: ConfiguracionRepository,
    private readonly calibraciones: CalibracionRepository,
  ) {}

  async execute(entrada: GuardarCalibracionEntrada, usuarioId: string | null = null): Promise<CalibracionGuardadaDto> {
    const { marcas, omitidos } = validarMarcas(entrada?.marcas, entrada?.omitidos)
    const tam = validarTamanoImagen(entrada?.image_size)
    const geometria = geometriaDe((await configuracionEfectiva(this.configuracion)).piscina)
    const nombre = validarNombre(entrada?.nombre) ?? null
    const zonas = validarZonas(entrada?.zonas, tam, geometria) ?? null
    const cuerdas = validarCuerdas(entrada?.cuerdas, geometria)
    const llegada = validarLlegada(entrada?.llegada, geometria) ?? null
    const imagen = validarImagen(entrada?.imagen) ?? null

    const evaluacion = evaluar(marcas, omitidos, geometria, cuerdas, tam)
    if (!evaluacion.H) {
      throw new ValidacionException(`Todavía no se puede guardar: ${evaluacion.mensaje}`, evaluacion.advertencias)
    }
    const archivo = aArchivoCalibracion(marcas, tam[0], tam[1], omitidos, geometria, cuerdas)
    if (!archivo) throw new ValidacionException('No se pudo armar la calibración.')

    const { id } = await this.calibraciones.guardar(archivo, usuarioId, { nombre, zonas, llegada, imagen })
    return {
      id,
      nombre,
      zonas: zonas?.map((z) => z.name) ?? [],
      llegada,
      completa: archivo.completa,
      rmse_m: archivo.rmse_m,
      cruzado_m: archivo.cruzado_m,
    }
  }
}
