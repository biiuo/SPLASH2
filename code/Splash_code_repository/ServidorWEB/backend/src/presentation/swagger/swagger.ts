import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

/** Swagger se muestra en desarrollo y cuando se pide con SWAGGER=on. En producción queda apagado por defecto. */
export function swaggerHabilitado(): boolean {
  const pedido = process.env.SWAGGER?.toLowerCase()
  if (pedido === 'on' || pedido === 'true') return true
  if (pedido === 'off' || pedido === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

/** La documentación interactiva queda en /docs y la especificación OpenAPI en /docs-json. */
export function configurarSwagger(app: INestApplication): void {
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SafeSplash API')
      .setDescription(
        'API de SafeSplash: cuentas, configuración de la piscina y la cámara, calibración (homografía) y sesiones.\n\n' +
          '**Casi todo pide sesión iniciada.** Creá una cuenta o ingresá en *Cuenta* (`/api/auth/registro` o ' +
          '`/api/auth/ingresar`), copiá el `token` de la respuesta y pegalo en el botón **Authorize**. ' +
          'El servidor de IA usa su propio token (IA_TOKEN) y solo entra a las rutas que necesita para medir.',
      )
      .setVersion('0.2.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build(),
  )
  // sin prefijo global: la documentación queda en /docs, fuera de /api
  SwaggerModule.setup('docs', app, documento, { useGlobalPrefix: false, jsonDocumentUrl: 'docs-json' })
}
