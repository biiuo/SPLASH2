import { Module } from '@nestjs/common'

import { AnalizarConfiguracionUseCase } from '../../application/use-cases/configuracion/analizar-configuracion.usecase'
import { GuardarConfiguracionUseCase } from '../../application/use-cases/configuracion/guardar-configuracion.usecase'
import { ObtenerConfiguracionUseCase } from '../../application/use-cases/configuracion/obtener-configuracion.usecase'
import { CONFIGURACION_REPOSITORY, type ConfiguracionRepository } from '../../domain/repositories/configuracion.repository'
import type { ModoProceso } from '../../domain/entities/sesion.entity'
import { ConfiguracionController } from '../controllers/configuracion.controller'
import { MODO_POR_DEFECTO } from './ajustes.module'

// Los casos de uso son clases simples (sin decoradores de Nest): se arman acá con las dependencias que necesitan.
@Module({
  controllers: [ConfiguracionController],
  providers: [
    {
      provide: ObtenerConfiguracionUseCase,
      useFactory: (repo: ConfiguracionRepository, modo: ModoProceso) => new ObtenerConfiguracionUseCase(repo, modo),
      inject: [CONFIGURACION_REPOSITORY, MODO_POR_DEFECTO],
    },
    {
      provide: GuardarConfiguracionUseCase,
      useFactory: (repo: ConfiguracionRepository) => new GuardarConfiguracionUseCase(repo),
      inject: [CONFIGURACION_REPOSITORY],
    },
    { provide: AnalizarConfiguracionUseCase, useFactory: () => new AnalizarConfiguracionUseCase() },
  ],
})
export class ConfiguracionModule {}
