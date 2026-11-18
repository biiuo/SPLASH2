import { Module } from '@nestjs/common'

import { PerfilNadadorUseCases } from '../../application/use-cases/perfil-nadador/perfil-nadador.usecases'
import { GRUPO_REPOSITORY, NADADOR_REPOSITORY, type GrupoRepository, type NadadorRepository } from '../../domain/repositories/nadador.repository'
import { PERFIL_NADADOR_REPOSITORY, type PerfilNadadorRepository } from '../../domain/repositories/perfil-nadador.repository'
import { PerfilNadadorController } from '../controllers/perfil-nadador.controller'

@Module({
  controllers: [PerfilNadadorController],
  providers: [
    {
      provide: PerfilNadadorUseCases,
      useFactory: (p: PerfilNadadorRepository, n: NadadorRepository, g: GrupoRepository) => new PerfilNadadorUseCases(p, n, g),
      inject: [PERFIL_NADADOR_REPOSITORY, NADADOR_REPOSITORY, GRUPO_REPOSITORY],
    },
  ],
})
export class PerfilNadadorModule {}
