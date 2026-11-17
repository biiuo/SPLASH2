import { Module } from '@nestjs/common'

import { ObjetivosUseCases } from '../../application/use-cases/objetivos/objetivos.usecases'
import { GRUPO_REPOSITORY, NADADOR_REPOSITORY, type GrupoRepository, type NadadorRepository } from '../../domain/repositories/nadador.repository'
import { OBJETIVO_REPOSITORY, type ObjetivoRepository } from '../../domain/repositories/objetivo.repository'
import { ObjetivosController } from '../controllers/objetivos.controller'

@Module({
  controllers: [ObjetivosController],
  providers: [
    {
      provide: ObjetivosUseCases,
      useFactory: (o: ObjetivoRepository, g: GrupoRepository, n: NadadorRepository) => new ObjetivosUseCases(o, g, n),
      inject: [OBJETIVO_REPOSITORY, GRUPO_REPOSITORY, NADADOR_REPOSITORY],
    },
  ],
})
export class ObjetivosModule {}
