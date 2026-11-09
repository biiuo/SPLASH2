import { Global, Module } from '@nestjs/common'

import { CALIBRACION_REPOSITORY } from '../../domain/repositories/calibracion.repository'
import { CONFIGURACION_REPOSITORY } from '../../domain/repositories/configuracion.repository'
import { RESULTADOS_REPOSITORY } from '../../domain/repositories/resultados.repository'
import { SESION_REPOSITORY } from '../../domain/repositories/sesion.repository'
import { NADADOR_REPOSITORY } from '../../domain/repositories/nadador.repository'
import { USUARIO_REPOSITORY } from '../../domain/repositories/usuario.repository'
import { PrismaNadadorRepository } from '../../infrastructure/repositories/prisma-nadador.repository'
import { PrismaUsuarioRepository } from '../../infrastructure/repositories/prisma-usuario.repository'
import { PrismaService } from '../../infrastructure/persistence/prisma.service'
import { PrismaCalibracionRepository } from '../../infrastructure/repositories/prisma-calibracion.repository'
import { PrismaConfiguracionRepository } from '../../infrastructure/repositories/prisma-configuracion.repository'
import { PrismaResultadosRepository } from '../../infrastructure/repositories/prisma-resultados.repository'
import { PrismaSesionRepository } from '../../infrastructure/repositories/prisma-sesion.repository'

/** Conecta cada interfaz de repositorio del dominio con su implementación de Prisma. Es el único lugar que las une. */
@Global()
@Module({
  providers: [
    PrismaService,
    { provide: CONFIGURACION_REPOSITORY, useClass: PrismaConfiguracionRepository },
    { provide: CALIBRACION_REPOSITORY, useClass: PrismaCalibracionRepository },
    { provide: SESION_REPOSITORY, useClass: PrismaSesionRepository },
    { provide: RESULTADOS_REPOSITORY, useClass: PrismaResultadosRepository },
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: NADADOR_REPOSITORY, useClass: PrismaNadadorRepository },
  ],
  exports: [PrismaService, CONFIGURACION_REPOSITORY, CALIBRACION_REPOSITORY, SESION_REPOSITORY, RESULTADOS_REPOSITORY, USUARIO_REPOSITORY, NADADOR_REPOSITORY],
})
export class DbModule {}
