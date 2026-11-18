import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'

import { PerfilNadadorUseCases } from '../../application/use-cases/perfil-nadador/perfil-nadador.usecases'
import { ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import type { Identidad, Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { Roles, Solicitante } from '../auth/decoradores'

const persona = (s: TipoSolicitante): Identidad => {
  if (s.tipo !== 'usuario') throw new ProhibidoException()
  return s
}

/** El perfil deportivo del nadador: cuestionario inicial, tiempos personales e historia. */
@ApiTags('perfil del nadador')
@ApiBearerAuth()
@Controller('perfil-nadador')
export class PerfilNadadorController {
  constructor(private readonly perfil: PerfilNadadorUseCases) {}

  @Get('yo')
  @Roles('nadador')
  @ApiOperation({
    summary: 'Mi perfil deportivo',
    description: '`estado`: `nuevo` (nunca lo abrió), `en_progreso`, `omitido` (eligió completarlo más tarde) o `completo`. Incluye tiempos, marcas calculadas e historia.',
  })
  mio(@Solicitante() s: TipoSolicitante) {
    return this.perfil.mio(persona(s))
  }

  @Put('yo')
  @Roles('nadador')
  @ApiOperation({
    summary: 'Guardar respuestas (de a poco)',
    description: '`{ respuestas: { clave: valor, ... }, etapa? }`. Solo se mandan las que cambian; `null` borra una respuesta.',
  })
  @ApiBody({ schema: { type: 'object' }, examples: { ejemplo: { summary: 'Datos personales', value: { respuestas: { fecha_nacimiento: '2008-05-14', sexo: 'femenino' }, etapa: 2 } } } })
  guardar(@Solicitante() s: TipoSolicitante, @Body() cuerpo: { respuestas?: unknown; etapa?: unknown }) {
    return this.perfil.guardar(persona(s), cuerpo)
  }

  @Post('yo/finalizar')
  @Roles('nadador')
  @HttpCode(200)
  @ApiOperation({ summary: 'Terminar (o guardar una edición)', description: 'Pide fecha de nacimiento y sexo. Deja una versión de la historia en el historial.' })
  finalizar(@Solicitante() s: TipoSolicitante) {
    return this.perfil.finalizar(persona(s))
  }

  @Post('yo/omitir')
  @Roles('nadador')
  @HttpCode(200)
  @ApiOperation({ summary: 'Completar más tarde', description: 'El cuestionario no se vuelve a abrir solo; se retoma desde Mi perfil.' })
  omitir(@Solicitante() s: TipoSolicitante) {
    return this.perfil.omitir(persona(s))
  }

  @Post('yo/tiempos')
  @Roles('nadador')
  @HttpCode(201)
  @ApiOperation({ summary: 'Registrar un tiempo', description: '`{ estilo, distancia_m, piscina_m: 25|50, tiempo_ms, fecha: AAAA-MM-DD }`' })
  @ApiBody({ schema: { type: 'object' }, examples: { ejemplo: { summary: '100 m libre', value: { estilo: 'libre', distancia_m: 100, piscina_m: 25, tiempo_ms: 72450, fecha: '2026-10-02' } } } })
  agregarTiempo(@Solicitante() s: TipoSolicitante, @Body() cuerpo: Record<string, unknown>) {
    return this.perfil.agregarTiempo(persona(s), cuerpo)
  }

  @Delete('yo/tiempos/:id')
  @Roles('nadador')
  @ApiOperation({ summary: 'Borrar un tiempo propio' })
  borrarTiempo(@Solicitante() s: TipoSolicitante, @Param('id') id: string) {
    return this.perfil.borrarTiempo(persona(s), id)
  }

  @Get(':nadadorId')
  @Roles('entrenador', 'administrador')
  @ApiOperation({ summary: 'Perfil de un nadador', description: 'El entrenador ve los de sus grupos; el administrador, todos.' })
  deNadador(@Solicitante() s: TipoSolicitante, @Param('nadadorId') id: string) {
    return this.perfil.deNadador(persona(s), id)
  }
}
