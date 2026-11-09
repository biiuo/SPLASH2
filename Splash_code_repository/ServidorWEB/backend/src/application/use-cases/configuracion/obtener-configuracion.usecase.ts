import { Configuracion } from '../../../domain/entities/configuracion.entity'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import type { ModoProceso } from '../../../domain/entities/sesion.entity'
import type { ConfiguracionEfectivaDto } from '../../dtos/configuracion.dto'

export class ObtenerConfiguracionUseCase {
  constructor(
    private readonly repo: ConfiguracionRepository,
    /** PROCESAR_EN del .env. */
    private readonly modoPorDefecto: ModoProceso,
  ) {}

  async execute(): Promise<ConfiguracionEfectivaDto> {
    const guardada = await this.repo.obtener()
    const fabrica = Configuracion.porDefecto()
    const enUso = guardada ?? fabrica
    return {
      configuracion: enUso.aJSON(),
      guardada: guardada !== null,
      fabrica: fabrica.aJSON(),
      modo_procesamiento: enUso.modoProcesamiento(this.modoPorDefecto),
      modo_por_defecto: this.modoPorDefecto,
    }
  }
}
