import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'

import { ExcepcionesFilter } from './presentation/filters/excepciones.filter'
import { configurarSwagger } from './presentation/swagger/swagger'

/** Configuración común de la API (la usan main.ts y las pruebas de punta a punta). `swagger` agrega /docs. */
export function configurarApp(app: INestApplication, opciones: { swagger?: boolean } = {}): INestApplication {
  app.setGlobalPrefix('api')
  // la calibración se guarda con la imagen sobre la que se marcó (JPEG en base64, cientos de KB): el límite por
  // defecto de 100 KB no alcanza
  ;(app as NestExpressApplication).useBodyParser('json', { limit: '10mb' })
  app.useGlobalFilters(new ExcepcionesFilter())
  app.enableShutdownHooks()
  if (opciones.swagger) configurarSwagger(app)
  return app
}
