// primero: carga backend/.env (si existe) antes de que cualquier módulo lea las variables
import './cargar-env'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { configurarApp } from './configurar-app'
import { swaggerHabilitado } from './presentation/swagger/swagger'

async function bootstrap() {
  const swagger = swaggerHabilitado()
  const app = configurarApp(await NestFactory.create(AppModule), { swagger })
  const puerto = Number(process.env.PORT ?? 3001)
  await app.listen(puerto, '0.0.0.0')

  const log = new Logger('Bootstrap')
  log.log(`API escuchando en el puerto ${puerto}`)
  if (swagger) log.log(`Documentación (Swagger): http://localhost:${puerto}/docs`)
}

void bootstrap()
