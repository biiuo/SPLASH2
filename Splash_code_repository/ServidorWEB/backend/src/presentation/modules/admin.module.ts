import { Module } from '@nestjs/common'

import { AdminUseCases } from '../../application/use-cases/admin/admin.usecases'
import { CIFRADOR_CONTRASENAS, type CifradorContrasenas } from '../../application/ports/autenticacion.ports'
import { LATIDO_REPOSITORY, type LatidoRepository } from '../../domain/repositories/latido.repository'
import { SESION_REPOSITORY, type SesionRepository } from '../../domain/repositories/sesion.repository'
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../domain/repositories/usuario.repository'
import { GRUPO_REPOSITORY, type GrupoRepository } from '../../domain/repositories/nadador.repository'
import { AdminController, LatidosController } from '../controllers/admin.controller'

@Module({
  controllers: [AdminController, LatidosController],
  providers: [
    {
      provide: AdminUseCases,
      useFactory: (u: UsuarioRepository, s: SesionRepository, l: LatidoRepository, c: CifradorContrasenas, g: GrupoRepository) =>
        new AdminUseCases(u, s, l, c, g),
      inject: [USUARIO_REPOSITORY, SESION_REPOSITORY, LATIDO_REPOSITORY, CIFRADOR_CONTRASENAS, GRUPO_REPOSITORY],
    },
  ],
})
export class AdminModule {}
