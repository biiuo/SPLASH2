import { Module } from '@nestjs/common'

import { ActivarCalibracionUseCase } from '../../application/use-cases/calibracion/activar-calibracion.usecase'
import { ActualizarCalibracionUseCase } from '../../application/use-cases/calibracion/actualizar-calibracion.usecase'
import { ObtenerImagenCalibracionUseCase } from '../../application/use-cases/calibracion/obtener-imagen.usecase'
import {
  ObtenerFrameCamaraUseCase,
  PublicarFrameCamaraUseCase,
} from '../../application/use-cases/calibracion/frame-camara.usecases'
import { ALMACEN_FRAME_CAMARA, type AlmacenFrameCamara } from '../../application/ports/frame-camara.ports'
import { FrameCamaraEnMemoria } from '../../infrastructure/camara/frame-camara-en-memoria'
import { ObtenerZonasUseCase } from '../../application/use-cases/calibracion/obtener-zonas.usecase'
import { ListarCalibracionesUseCase } from '../../application/use-cases/calibracion/listar-calibraciones.usecase'
import { EvaluarCalibracionUseCase } from '../../application/use-cases/calibracion/evaluar-calibracion.usecase'
import { GuardarCalibracionUseCase } from '../../application/use-cases/calibracion/guardar-calibracion.usecase'
import { ObtenerCalibracionActivaUseCase } from '../../application/use-cases/calibracion/obtener-calibracion-activa.usecase'
import { ObtenerPuntosReferenciaUseCase } from '../../application/use-cases/calibracion/obtener-puntos-referencia.usecase'
import { CALIBRACION_REPOSITORY, type CalibracionRepository } from '../../domain/repositories/calibracion.repository'
import { CONFIGURACION_REPOSITORY, type ConfiguracionRepository } from '../../domain/repositories/configuracion.repository'
import { CalibracionController } from '../controllers/calibracion.controller'

@Module({
  controllers: [CalibracionController],
  providers: [
    { provide: ALMACEN_FRAME_CAMARA, useClass: FrameCamaraEnMemoria },
    {
      provide: PublicarFrameCamaraUseCase,
      useFactory: (almacen: AlmacenFrameCamara) => new PublicarFrameCamaraUseCase(almacen),
      inject: [ALMACEN_FRAME_CAMARA],
    },
    {
      provide: ObtenerFrameCamaraUseCase,
      useFactory: (almacen: AlmacenFrameCamara) => new ObtenerFrameCamaraUseCase(almacen),
      inject: [ALMACEN_FRAME_CAMARA],
    },
    {
      provide: ObtenerPuntosReferenciaUseCase,
      useFactory: (config: ConfiguracionRepository) => new ObtenerPuntosReferenciaUseCase(config),
      inject: [CONFIGURACION_REPOSITORY],
    },
    {
      provide: EvaluarCalibracionUseCase,
      useFactory: (config: ConfiguracionRepository) => new EvaluarCalibracionUseCase(config),
      inject: [CONFIGURACION_REPOSITORY],
    },
    {
      provide: GuardarCalibracionUseCase,
      useFactory: (config: ConfiguracionRepository, calibraciones: CalibracionRepository) =>
        new GuardarCalibracionUseCase(config, calibraciones),
      inject: [CONFIGURACION_REPOSITORY, CALIBRACION_REPOSITORY],
    },
    {
      provide: ObtenerCalibracionActivaUseCase,
      useFactory: (calibraciones: CalibracionRepository) => new ObtenerCalibracionActivaUseCase(calibraciones),
      inject: [CALIBRACION_REPOSITORY],
    },
    {
      provide: ListarCalibracionesUseCase,
      useFactory: (calibraciones: CalibracionRepository) => new ListarCalibracionesUseCase(calibraciones),
      inject: [CALIBRACION_REPOSITORY],
    },
    {
      provide: ActivarCalibracionUseCase,
      useFactory: (calibraciones: CalibracionRepository) => new ActivarCalibracionUseCase(calibraciones),
      inject: [CALIBRACION_REPOSITORY],
    },
    {
      provide: ActualizarCalibracionUseCase,
      useFactory: (calibraciones: CalibracionRepository) => new ActualizarCalibracionUseCase(calibraciones),
      inject: [CALIBRACION_REPOSITORY],
    },
    {
      provide: ObtenerImagenCalibracionUseCase,
      useFactory: (calibraciones: CalibracionRepository) => new ObtenerImagenCalibracionUseCase(calibraciones),
      inject: [CALIBRACION_REPOSITORY],
    },
    {
      provide: ObtenerZonasUseCase,
      useFactory: (calibraciones: CalibracionRepository) => new ObtenerZonasUseCase(calibraciones),
      inject: [CALIBRACION_REPOSITORY],
    },
  ],
})
export class CalibracionModule {}
