import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AdminUseCases } from '../../application/use-cases/admin/admin.usecases'
import { ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import type { Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { PermiteServicio, Roles, Solicitante } from '../auth/decoradores'

/** El módulo del administrador: resumen del sistema, cuentas y monitoreo. */
@ApiTags('administración')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminUseCases) {}

  @Get('resumen')
  @Roles('administrador')
  @ApiOperation({ summary: 'Resumen del sistema', description: 'Cuentas por rol, sesiones por estado y por día, con errores de detección, recientes y rendimiento general.' })
  resumen() {
    return this.admin.resumen()
  }

  @Get('usuarios')
  @Roles('administrador')
  @ApiOperation({
    summary: 'Buscar usuarios',
    description:
      '`?texto=` busca en correo y nombre; `?rol=` y `?activo=true|false` filtran; `?pendiente=true` lista solo los entrenadores ' +
      'que esperan aprobación (sin él, no aparecen); `?pagina=` y `?por_pagina=` (10 por defecto, hasta 50). Devuelve `{ usuarios, total, pagina, por_pagina }`.',
  })
  usuarios(
    @Query('texto') texto?: string,
    @Query('rol') rol?: string,
    @Query('activo') activo?: string,
    @Query('pendiente') pendiente?: string,
    @Query('pagina') pagina?: string,
    @Query('por_pagina') por_pagina?: string,
  ) {
    return this.admin.listarUsuarios({ texto, rol, activo, pendiente, pagina, por_pagina })
  }

  @Post('usuarios/:id/aprobar')
  @Roles('administrador')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceptar un entrenador', description: 'El entrenador que se registró puede iniciar sesión desde ahora.' })
  aprobar(@Param('id') id: string) {
    return this.admin.aprobarEntrenador(id)
  }

  @Post('usuarios/:id/rechazar')
  @Roles('administrador')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rechazar un entrenador', description: 'Borra la cuenta pendiente (no tiene datos); el correo queda libre para registrarse otra vez.' })
  @ApiOkResponse({ description: '`{ ok: true }`' })
  rechazar(@Param('id') id: string) {
    return this.admin.rechazarEntrenador(id)
  }

  @Post('grupos')
  @Roles('administrador')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear un grupo para un entrenador', description: '`{ entrenador_id, nombre }`' })
  crearGrupo(@Body() cuerpo: { entrenador_id?: unknown; nombre?: unknown }) {
    return this.admin.crearGrupoPara(cuerpo?.entrenador_id, cuerpo?.nombre)
  }

  @Patch('grupos/:id')
  @Roles('administrador')
  @ApiOperation({ summary: 'Pasar un grupo a otro entrenador', description: '`{ entrenador_id }`. El grupo conserva sus nadadores.' })
  asignarGrupo(@Param('id') id: string, @Body() cuerpo: { entrenador_id?: unknown }) {
    return this.admin.asignarGrupo(id, cuerpo?.entrenador_id)
  }

  @Post('usuarios')
  @Roles('administrador')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear un usuario', description: 'De cualquier rol, también administrador. `{ email, nombre, contrasena, rol, telefono? }`' })
  crear(@Body() cuerpo: { email?: unknown; nombre?: unknown; contrasena?: unknown; rol?: unknown; telefono?: unknown }) {
    return this.admin.crearUsuario(cuerpo)
  }

  @Patch('usuarios/:id')
  @Roles('administrador')
  @ApiOperation({ summary: 'Cambiar un usuario', description: '`{ nombre?, telefono?, rol?, activo? }`. No te podés quitar el rol ni desactivar.' })
  actualizar(@Param('id') id: string, @Body() cuerpo: { nombre?: unknown; telefono?: unknown; rol?: unknown; activo?: unknown }, @Solicitante() s: TipoSolicitante) {
    if (s.tipo !== 'usuario') throw new ProhibidoException()
    return this.admin.actualizarUsuario(s, id, cuerpo)
  }

  @Post('usuarios/:id/contrasena')
  @Roles('administrador')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer la contraseña', description: '`{ nueva }`: la contraseña que el administrador le comunica a la persona.' })
  @ApiOkResponse({ description: '`{ ok: true }`' })
  contrasena(@Param('id') id: string, @Body() cuerpo: { nueva?: unknown }) {
    return this.admin.restablecerContrasena(id, cuerpo?.nueva)
  }

  @Get('monitoreo')
  @Roles('administrador')
  @ApiOperation({ summary: 'Monitoreo en tiempo real', description: 'El estado de cada componente (último latido) y las sesiones en curso.' })
  monitoreo() {
    return this.admin.monitoreo()
  }
}

/** El heartbeat: el servidor de IA (y los celulares) avisan cada pocos segundos que están vivos. */
@ApiTags('administración')
@Controller('latidos')
export class LatidosController {
  constructor(private readonly admin: AdminUseCases) {}

  @Post()
  @PermiteServicio()
  @Roles('administrador')
  @HttpCode(200)
  @ApiOperation({ summary: 'Latido de un componente', description: '`{ componente: "ia", estado: { camara_conectada, procesando, fps, ... } }`. Lo manda el servidor de IA con su token.' })
  latido(@Body() cuerpo: { componente?: unknown; estado?: unknown }) {
    return this.admin.registrarLatido(cuerpo?.componente, cuerpo?.estado)
  }

  @Get()
  @Roles('entrenador', 'administrador')
  @ApiOperation({ summary: 'Estado de los componentes', description: 'Servidor de IA y cámara: si están vivos y su último estado (para el monitoreo del entrenador).' })
  async estado() {
    return (await this.admin.monitoreo()).componentes
  }
}
