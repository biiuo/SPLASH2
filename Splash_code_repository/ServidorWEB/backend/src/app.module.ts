import { Module } from '@nestjs/common'

import { SaludController } from './presentation/controllers/salud.controller'
import { AjustesModule } from './presentation/modules/ajustes.module'
import { AuthModule } from './presentation/modules/auth.module'
import { CalibracionModule } from './presentation/modules/calibracion.module'
import { ConfiguracionModule } from './presentation/modules/configuracion.module'
import { DbModule } from './presentation/modules/db.module'
import { SesionesModule } from './presentation/modules/sesiones.module'

@Module({
  imports: [DbModule, AjustesModule, AuthModule, ConfiguracionModule, CalibracionModule, SesionesModule],
  controllers: [SaludController],
})
export class AppModule {}
