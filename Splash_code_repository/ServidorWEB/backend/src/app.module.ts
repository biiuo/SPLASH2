import { Module } from '@nestjs/common'

import { AdminModule } from './presentation/modules/admin.module'
import { ObjetivosModule } from './presentation/modules/objetivos.module'

import { SaludController } from './presentation/controllers/salud.controller'
import { AjustesModule } from './presentation/modules/ajustes.module'
import { AuthModule } from './presentation/modules/auth.module'
import { CalibracionModule } from './presentation/modules/calibracion.module'
import { ConfiguracionModule } from './presentation/modules/configuracion.module'
import { DbModule } from './presentation/modules/db.module'
import { SesionesModule } from './presentation/modules/sesiones.module'

@Module({
  imports: [DbModule, AjustesModule, AuthModule, ConfiguracionModule, CalibracionModule, SesionesModule, AdminModule, ObjetivosModule],
  controllers: [SaludController],
})
export class AppModule {}
