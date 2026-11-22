import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import {
  ERROR_ACEPTABLE_M,
  ERROR_BUENO_M,
  ERROR_PX_ACEPTABLE,
  ERROR_PX_BUENO,
  anchoTotal,
  cuerdasReferencia,
  geometriaDe,
  puntosReferencia,
} from '../../../domain/services/evaluador-calibracion'
import type { PuntosReferenciaDto } from '../../dtos/calibracion.dto'
import { configuracionEfectiva } from '../configuracion/configuracion-efectiva'

/** Qué puntos hay que marcar en la imagen, según la piscina configurada. */
export class ObtenerPuntosReferenciaUseCase {
  constructor(private readonly configuracion: ConfiguracionRepository) {}

  async execute(): Promise<PuntosReferenciaDto> {
    const geometria = geometriaDe((await configuracionEfectiva(this.configuracion)).piscina)
    return {
      geometria,
      anchoTotal_m: anchoTotal(geometria),
      puntos: puntosReferencia(geometria),
      cuerdas: cuerdasReferencia(geometria),
      umbrales_error_m: { bueno: ERROR_BUENO_M, aceptable: ERROR_ACEPTABLE_M },
      umbrales_error_px: { bueno: ERROR_PX_BUENO, aceptable: ERROR_PX_ACEPTABLE },
    }
  }
}
