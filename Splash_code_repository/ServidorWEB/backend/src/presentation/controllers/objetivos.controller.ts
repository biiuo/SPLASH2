import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ObjetivosUseCases } from '../../application/use-cases/objetivos/objetivos.usecases'
import { ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import type { Identidad, Rol, Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { Roles, Solicitante } from '../auth/decoradores'

const ENTRENAN: Rol[] = ['entrenador', 'administrador']
const persona = (s: TipoSolicitante): Identidad => {
  if (s.tipo !== 'usuario') throw new ProhibidoException()
  return s
}

/** Objetivos de los nadadores: los pone el entrenador; el nadador ve los suyos. */
@ApiTags('objetivos')
@ApiBearerAuth()
@Controller('objetivos')
export class ObjetivosController {
  constructor(private readonly objetivos: ObjetivosUseCases) {}

  @Get()
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Objetivos de mis nadadores', description: 'Los de los nadadores de mis grupos (el administrador ve todos).' })
  listar(@Solicitante() s: TipoSolicitante) {
    return this.objetivos.listar(persona(s))
  }

  @Get('mios')
  @Roles('nadador')
  @ApiOperation({ summary: 'Mis objetivos (nadador)' })
  mios(@Solicitante() s: TipoSolicitante) {
    return this.objetivos.deNadador(persona(s))
  }

  @Post()
  @Roles(...ENTRENAN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear un objetivo', description: '`{ nadador_id, tipo: distancia|velocidad|tiempo_largo, meta, desde, hasta, descripcion? }`' })
  crear(@Body() cuerpo: Record<string, unknown>, @Solicitante() s: TipoSolicitante) {
    return this.objetivos.crear(persona(s), cuerpo)
  }

  @Patch(':id')
  @Roles(...ENTRENAN)
  @ApiOperation({ summary: 'Cambiar un objetivo' })
  actualizar(@Param('id') id: string, @Body() cuerpo: Record<string, unknown>, @Solicitante() s: TipoSolicitante) {
    return this.objetivos.actualizar(persona(s), id, cuerpo)
  }

  @Delete(':id')
  @Roles(...ENTRENAN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar un objetivo' })
  borrar(@Param('id') id: string, @Solicitante() s: TipoSolicitante) {
    return this.objetivos.borrar(persona(s), id)
  }
}
