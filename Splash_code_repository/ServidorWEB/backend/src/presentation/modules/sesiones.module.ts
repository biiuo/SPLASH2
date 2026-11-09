import { Module } from '@nestjs/common'

import { CANAL_AVISOS, type CanalAvisos } from '../../application/ports/avisos.ports'
import { RegistroMotores } from '../../application/servicios-motores'
import { GrupoUseCases } from '../../application/use-cases/grupo/grupo.usecases'
import { EstadoCarrilesUseCase } from '../../application/use-cases/sesiones/estado-carriles.usecase'
import { FinalizarSesionUseCase } from '../../application/use-cases/sesiones/finalizar-sesion.usecase'
import { IniciarSesionUseCase } from '../../application/use-cases/sesiones/iniciar-sesion.usecase'
import { ListarSesionesUseCase } from '../../application/use-cases/sesiones/listar-sesiones.usecase'
import { ObtenerResultadosUseCase } from '../../application/use-cases/sesiones/obtener-resultados.usecase'
import { ObtenerSesionActivaUseCase } from '../../application/use-cases/sesiones/obtener-sesion-activa.usecase'
import { RecibirTrayectoriasUseCase } from '../../application/use-cases/sesiones/recibir-trayectorias.usecase'
import { RepartirTrayectoriasUseCase } from '../../application/use-cases/sesiones/repartir-trayectorias.usecase'
import { UnirseSesionUseCase } from '../../application/use-cases/sesiones/unirse-sesion.usecase'
import type { ModoProceso } from '../../domain/entities/sesion.entity'
import { CALIBRACION_REPOSITORY, type CalibracionRepository } from '../../domain/repositories/calibracion.repository'
import { CONFIGURACION_REPOSITORY, type ConfiguracionRepository } from '../../domain/repositories/configuracion.repository'
import { NADADOR_REPOSITORY, type NadadorRepository } from '../../domain/repositories/nadador.repository'
import { RESULTADOS_REPOSITORY, type ResultadosRepository } from '../../domain/repositories/resultados.repository'
import { SESION_REPOSITORY, type SesionRepository } from '../../domain/repositories/sesion.repository'
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../domain/repositories/usuario.repository'
import { AvisosEnMemoria } from '../../infrastructure/avisos/avisos-en-memoria'
import { GrupoController } from '../controllers/grupo.controller'
import { SesionesController } from '../controllers/sesiones.controller'
import { MODO_POR_DEFECTO } from './ajustes.module'

// Los casos de uso son clases simples (sin decoradores de Nest): se arman aquí con las dependencias que necesitan.
@Module({
  controllers: [SesionesController, GrupoController],
  providers: [
    // un solo registro para todo el servidor: los motores tienen que sobrevivir entre un pedido y otro
    RegistroMotores,
    // un solo canal de avisos: quien publica y quien escucha tienen que ser el mismo
    { provide: CANAL_AVISOS, useClass: AvisosEnMemoria },
    {
      provide: IniciarSesionUseCase,
      useFactory: (
        sesiones: SesionRepository,
        calibraciones: CalibracionRepository,
        nadadores: NadadorRepository,
        avisos: CanalAvisos,
        configuracion: ConfiguracionRepository,
        modo: ModoProceso,
      ) => new IniciarSesionUseCase(sesiones, calibraciones, nadadores, avisos, configuracion, modo),
      inject: [SESION_REPOSITORY, CALIBRACION_REPOSITORY, NADADOR_REPOSITORY, CANAL_AVISOS, CONFIGURACION_REPOSITORY, MODO_POR_DEFECTO],
    },
    {
      provide: UnirseSesionUseCase,
      useFactory: (sesiones: SesionRepository, calibraciones: CalibracionRepository, nadadores: NadadorRepository, avisos: CanalAvisos) =>
        new UnirseSesionUseCase(sesiones, calibraciones, nadadores, avisos),
      inject: [SESION_REPOSITORY, CALIBRACION_REPOSITORY, NADADOR_REPOSITORY, CANAL_AVISOS],
    },
    {
      provide: EstadoCarrilesUseCase,
      useFactory: (sesiones: SesionRepository, nadadores: NadadorRepository, configuracion: ConfiguracionRepository) =>
        new EstadoCarrilesUseCase(sesiones, nadadores, configuracion),
      inject: [SESION_REPOSITORY, NADADOR_REPOSITORY, CONFIGURACION_REPOSITORY],
    },
    {
      provide: ListarSesionesUseCase,
      useFactory: (sesiones: SesionRepository) => new ListarSesionesUseCase(sesiones),
      inject: [SESION_REPOSITORY],
    },
    {
      provide: ObtenerSesionActivaUseCase,
      useFactory: (sesiones: SesionRepository) => new ObtenerSesionActivaUseCase(sesiones),
      inject: [SESION_REPOSITORY],
    },
    {
      provide: RecibirTrayectoriasUseCase,
      useFactory: (
        sesiones: SesionRepository,
        calibraciones: CalibracionRepository,
        resultados: ResultadosRepository,
        motores: RegistroMotores,
        avisos: CanalAvisos,
      ) => new RecibirTrayectoriasUseCase(sesiones, calibraciones, resultados, motores, avisos),
      inject: [SESION_REPOSITORY, CALIBRACION_REPOSITORY, RESULTADOS_REPOSITORY, RegistroMotores, CANAL_AVISOS],
    },
    {
      provide: RepartirTrayectoriasUseCase,
      useFactory: (sesiones: SesionRepository, recibir: RecibirTrayectoriasUseCase) => new RepartirTrayectoriasUseCase(sesiones, recibir),
      inject: [SESION_REPOSITORY, RecibirTrayectoriasUseCase],
    },
    {
      provide: FinalizarSesionUseCase,
      useFactory: (sesiones: SesionRepository, motores: RegistroMotores, avisos: CanalAvisos) =>
        new FinalizarSesionUseCase(sesiones, motores, avisos),
      inject: [SESION_REPOSITORY, RegistroMotores, CANAL_AVISOS],
    },
    {
      provide: ObtenerResultadosUseCase,
      useFactory: (sesiones: SesionRepository, resultados: ResultadosRepository) => new ObtenerResultadosUseCase(sesiones, resultados),
      inject: [SESION_REPOSITORY, RESULTADOS_REPOSITORY],
    },
    {
      provide: GrupoUseCases,
      useFactory: (nadadores: NadadorRepository, usuarios: UsuarioRepository) => new GrupoUseCases(nadadores, usuarios),
      inject: [NADADOR_REPOSITORY, USUARIO_REPOSITORY],
    },
  ],
})
export class SesionesModule {}
