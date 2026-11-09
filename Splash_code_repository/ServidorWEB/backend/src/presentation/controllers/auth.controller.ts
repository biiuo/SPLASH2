import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import {
  IngresarUseCase,
  ObtenerPerfilUseCase,
  RegistrarseUseCase,
  type IngresoEntrada,
  type RegistroEntrada,
} from '../../application/use-cases/auth/auth.usecases'
import type { Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import { Publico, Solicitante } from '../auth/decoradores'

@ApiTags('Cuenta')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrarse: RegistrarseUseCase,
    private readonly ingresar: IngresarUseCase,
    private readonly perfil: ObtenerPerfilUseCase,
  ) {}

  @Publico()
  @Post('registro')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Crear una cuenta',
    description:
      '`rol` es `nadador` o `entrenador` (un administrador no se puede registrar solo). Devuelve el token: la cuenta ' +
      'queda con la sesión iniciada. Mandalo en las demás rutas como `Authorization: Bearer <token>` (botón Authorize).',
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      entrenador: { summary: 'Entrenador', value: { email: 'entrenador@ejemplo.com', nombre: 'Ana Entrenadora', contrasena: 'clave-segura-1', rol: 'entrenador' } },
      nadador: { summary: 'Nadador', value: { email: 'nadador@ejemplo.com', nombre: 'Juan Nadador', contrasena: 'clave-segura-2', rol: 'nadador' } },
    },
  })
  @ApiCreatedResponse({ description: '`{ token, usuario: { id, email, nombre, rol, activo } }`' })
  @ApiConflictResponse({ description: 'Ya hay una cuenta con ese correo.' })
  registro(@Body() cuerpo: RegistroEntrada) {
    return this.registrarse.execute(cuerpo)
  }

  @Publico()
  @Post('ingresar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión', description: 'Devuelve el token para mandar en las demás rutas.' })
  @ApiBody({ schema: { type: 'object' }, examples: { entrenador: { summary: 'Entrenador', value: { email: 'entrenador@ejemplo.com', contrasena: 'clave-segura-1' } } } })
  @ApiOkResponse({ description: '`{ token, usuario }`' })
  @ApiUnauthorizedResponse({ description: 'Correo o contraseña incorrectos.' })
  ingreso(@Body() cuerpo: IngresoEntrada) {
    return this.ingresar.execute(cuerpo)
  }

  @Get('yo')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quién soy', description: 'El usuario de la sesión iniciada.' })
  @ApiOkResponse({ description: '`{ id, email, nombre, rol, activo }`' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión, o venció.' })
  yo(@Solicitante() s: TipoSolicitante) {
    if (s.tipo !== 'usuario') throw new ProhibidoException()
    return this.perfil.execute(s.id)
  }
}
