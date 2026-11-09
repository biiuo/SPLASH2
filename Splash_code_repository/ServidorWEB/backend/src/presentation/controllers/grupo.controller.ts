import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'
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

/** El grupo de un entrenador: los nadadores que eligió (los puede asignar a carriles de sus sesiones). */
@ApiTags('Grupo')
@ApiUnauthorizedResponse({ description: 'Sin sesión iniciada.' })
@Controller('grupo')
export class GrupoController {
  constructor(private readonly grupo: GrupoUseCases) {}

  @Get()
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Mi grupo', description: 'Los nadadores del entrenador que pregunta.' })
  @ApiOkResponse({ description: '`[{ id, nombre, email, usuario_id, entrenador_id }]`' })
  listar(@Solicitante() s: TipoSolicitante) {
    return this.grupo.listar(persona(s))
  }

  @Post()
  @Roles(...ENTRENAN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Agregar un nadador a mi grupo', description: 'Por el correo de su cuenta. Cada nadador tiene un solo entrenador.' })
  @ApiBody({ schema: { type: 'object' }, examples: { porCorreo: { summary: 'Por correo', value: { email: 'nadador@correo.com' } } } })
  @ApiCreatedResponse({ description: 'El nadador agregado.' })
  @ApiNotFoundResponse({ description: 'No hay una cuenta con ese correo.' })
  @ApiConflictResponse({ description: 'Ya está en este grupo o en el de otro entrenador.' })
  agregar(@Body() cuerpo: { email?: unknown }, @Solicitante() s: TipoSolicitante) {
    return this.grupo.agregar(persona(s), cuerpo?.email)
  }

  @Delete(':nadadorId')
  @Roles(...ENTRENAN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Sacar un nadador de mi grupo' })
  @ApiNoContentResponse({ description: 'Listo.' })
  @ApiNotFoundResponse({ description: 'No está en tu grupo.' })
  async quitar(@Param('nadadorId') nadadorId: string, @Solicitante() s: TipoSolicitante) {
    await this.grupo.quitar(persona(s), nadadorId)
  }

  @Get('mi-entrenador')
  @ApiOperation({ summary: 'Mi entrenador', description: 'Para un nadador: su entrenador, o `null` si no está en ningún grupo.' })
  @ApiOkResponse({ description: '`{ id, nombre }` o `null`.' })
  async miEntrenador(@Solicitante() s: TipoSolicitante) {
    return (await this.grupo.miEntrenador(persona(s))) ?? null
  }
}
