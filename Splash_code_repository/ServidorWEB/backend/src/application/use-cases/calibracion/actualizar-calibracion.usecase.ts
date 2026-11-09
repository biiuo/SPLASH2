import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import { esUuid } from '../../../domain/services/identificador'
import type { ActualizarCalibracionEntrada, CalibracionGuardadaDto } from '../../dtos/calibracion.dto'
import { NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'
import { validarImagen, validarLlegada, validarNombre, validarZonas } from './validar-entrada'

/**
 * Cambia el nombre o las zonas de una calibración ya guardada (por ejemplo, para dibujar las zonas después de calibrar).
 * La homografía no se toca: para eso se guarda una calibración nueva.
 *
 * Las zonas se validan contra la imagen y los carriles de ESA calibración. Una sesión en curso que la use no cambia de
 * zonas a mitad de camino: el servidor de IA las lee al unirse a la sesión.
 */
export class ActualizarCalibracionUseCase {
  constructor(private readonly calibraciones: CalibracionRepository) {}

  async execute(id: string, entrada: ActualizarCalibracionEntrada): Promise<CalibracionGuardadaDto> {
    const actual = esUuid(id) ? await this.calibraciones.obtener(id) : null
    if (!actual) throw new NoEncontradoException('No existe esa calibración.')

    const nombre = validarNombre(entrada?.nombre)
    const zonas = validarZonas(entrada?.zonas, actual.image_size, actual.geometria)
    const llegada = validarLlegada(entrada?.llegada, actual.geometria)
    const imagen = validarImagen(entrada?.imagen)
    if (nombre === undefined && zonas === undefined && llegada === undefined && imagen === undefined) {
      throw new ValidacionException('No hay nada para cambiar: mandá "nombre", "zonas", "llegada" y/o "imagen".')
    }

    const c = await this.calibraciones.actualizar(id, { nombre, zonas, llegada, imagen })
    if (!c) throw new NoEncontradoException('No existe esa calibración.')
    return {
      id: c.id,
      nombre: c.nombre,
      zonas: c.zonas?.map((z) => z.name) ?? [],
      llegada: c.llegada,
      completa: c.completa,
      rmse_m: c.rmse_m,
      cruzado_m: c.cruzado_m,
    }
  }
}
