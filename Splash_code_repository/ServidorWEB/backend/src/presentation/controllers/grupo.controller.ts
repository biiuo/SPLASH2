import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import { GrupoUseCases } from '../../application/use-cases/grupo/grupo.usecases'
import type { Identidad, Rol, Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { Roles, Solicitante } from '../auth/decoradores'

const ENTRENAN: Rol[] = ['entrenador', 'administrador']

function persona(s: TipoSolicitante): Identidad {
  if (s.tipo !== 'usuario') throw new ProhibidoException('Esta ruta es para personas.')
  return { id: s.id, rol: s.rol, nombre: s.nombre }
}

/** Los grupos de un entrenador (puede tener varios) y sus nadadores. */
@ApiTags('Grupos')
@ApiUnauthorizedResponse({ description: 'Sin sesión iniciada.' })
@Controller('grupos')
export class GrupoController {
  constructor(private readonly grupos: GrupoUseCases) {}

  @Get()
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Mis grupos', description: 'Los grupos del entrenador que pregunta, con sus nadadores.' })
  @ApiOkResponse({ description: '`[{ id, nombre, entrenador, nadadores: [{ id, nombre, email }] }]`' })
  misGrupos(@Solicitante() s: TipoSolicitante) {
    return this.grupos.misGrupos(persona(s))
  }

  @Post()
  @Roles(...ENTRENAN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear un grupo' })
  @ApiBody({ schema: { type: 'object' }, examples: { avanzados: { summary: 'Avanzados', value: { nombre: 'Avanzados' } } } })
  @ApiCreatedResponse({ description: 'El grupo creado (vacío).' })
  @ApiConflictResponse({ description: 'Ya tenés un grupo con ese nombre.' })
  crear(@Body() cuerpo: { nombre?: unknown }, @Solicitante() s: TipoSolicitante) {
    return this.grupos.crear(persona(s), cuerpo?.nombre)
  }

  @Get('nadadores')
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Todos los nadadores', description: 'Los nadadores registrados y en cuáles de mis grupos están (`mis_grupos`).' })
  @ApiOkResponse({ description: '`[{ id, nombre, email, mis_grupos: [id] }]`' })
  todos(@Solicitante() s: TipoSolicitante) {
    return this.grupos.todos(persona(s))
  }

  @Get('mios')
  @ApiOperation({ summary: 'Mis grupos (nadador)', description: 'Los grupos en los que está el nadador que pregunta, con su entrenador.' })
  @ApiOkResponse({ description: '`[{ id, nombre, entrenador }]`' })
  gruposDeNadador(@Solicitante() s: TipoSolicitante) {
    return this.grupos.gruposDeNadador(persona(s))
  }

  @Patch(':id')
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Cambiar el nombre de un grupo' })
  @ApiOkResponse({ description: 'El grupo.' })
  @ApiNotFoundResponse({ description: 'No existe ese grupo (o no es tuyo).' })
  renombrar(@Param('id') id: string, @Body() cuerpo: { nombre?: unknown }, @Solicitante() s: TipoSolicitante) {
    return this.grupos.renombrar(persona(s), id, cuerpo?.nombre)
  }

  @Delete(':id')
  @Roles(...ENTRENAN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar un grupo', description: 'Los nadadores no se borran: solo dejan de estar en ese grupo.' })
  @ApiNoContentResponse({ description: 'Listo.' })
  async borrar(@Param('id') id: string, @Solicitante() s: TipoSolicitante) {
    await this.grupos.borrar(persona(s), id)
  }

  @Post(':id/nadadores')
  @Roles(...ENTRENAN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Agregar un nadador al grupo', description: 'Por su id (de `GET /grupos/nadadores`) o por el correo de su cuenta.' })
  @ApiBody({ schema: { type: 'object' }, examples: { porCorreo: { summary: 'Por correo', value: { email: 'nadador@correo.com' } } } })
  @ApiCreatedResponse({ description: 'El grupo, con el nadador agregado.' })
  @ApiConflictResponse({ description: 'Ya está en ese grupo.' })
  agregar(@Param('id') id: string, @Body() cuerpo: { nadador_id?: unknown; email?: unknown }, @Solicitante() s: TipoSolicitante) {
    return this.grupos.agregar(persona(s), id, cuerpo ?? {})
  }

  @Delete(':id/nadadores/:nadadorId')
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Sacar un nadador del grupo' })
  @ApiOkResponse({ description: 'El grupo, sin ese nadador.' })
  quitar(@Param('id') id: string, @Param('nadadorId') nadadorId: string, @Solicitante() s: TipoSolicitante) {
    return this.grupos.quitar(persona(s), id, nadadorId)
  }
}
