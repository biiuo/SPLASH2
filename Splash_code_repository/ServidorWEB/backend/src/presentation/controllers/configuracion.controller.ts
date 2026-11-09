import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { AnalizarConfiguracionUseCase } from '../../application/use-cases/configuracion/analizar-configuracion.usecase'
import { GuardarConfiguracionUseCase } from '../../application/use-cases/configuracion/guardar-configuracion.usecase'
import { ObtenerConfiguracionUseCase } from '../../application/use-cases/configuracion/obtener-configuracion.usecase'
import type { Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { Roles, Solicitante, idDe } from '../auth/decoradores'
import { EJEMPLOS } from '../swagger/ejemplos'

const SIN_BASE = { description: 'La base de datos no está disponible.' }

@ApiTags('Configuración')
@ApiUnauthorizedResponse({ description: 'Sin sesión iniciada.' })
@Controller('configuracion')
export class ConfiguracionController {
  constructor(
    private readonly obtener: ObtenerConfiguracionUseCase,
    private readonly guardar: GuardarConfiguracionUseCase,
    private readonly analizar: AnalizarConfiguracionUseCase,
  ) {}

  /** La configuración en uso (la guardada, o la de fábrica) y si ya se guardó alguna. */
  @Get()
  @ApiOperation({
    summary: 'La configuración en uso',
    description:
      'Devuelve la configuración guardada o, si todavía no se guardó ninguna, la de fábrica. ' +
      '`guardada` dice cuál de las dos es, y `fabrica` trae siempre los valores de fábrica.',
  })
  @ApiOkResponse({ description: '`{ configuracion, guardada, fabrica }`' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  obtenerConfiguracion() {
    return this.obtener.execute()
  }

  @Put()
  @Roles('entrenador', 'administrador')
  @ApiOperation({
    summary: 'Guardar la configuración',
    description:
      'Valida y guarda. Lo que falte se completa con los valores de fábrica. Reemplaza a la guardada anteriormente. ' +
      'Solo entrenadores y administradores.',
  })
  @ApiForbiddenResponse({ description: 'Un nadador no puede cambiar la configuración.' })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      fabrica: { summary: 'Los valores de fábrica', value: EJEMPLOS.configuracion },
      invalida: { summary: 'Inválida (altura negativa): responde 400', value: EJEMPLOS.configuracionInvalida },
    },
  })
  @ApiOkResponse({ description: 'La configuración guardada.' })
  @ApiBadRequestResponse({ description: 'No es válida. `errores` lista qué está mal, en español.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  guardarConfiguracion(@Body() cuerpo: unknown, @Solicitante() s: TipoSolicitante) {
    return this.guardar.execute(cuerpo, idDe(s))
  }

  /** Analiza una configuración sin guardarla: errores, valores calculados, precisión esperada y avisos. */
  @Post('analisis')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Analizar una configuración (no guarda nada)',
    description:
      'Devuelve los errores, los valores calculados (ancho de carril, focal en píxeles, ángulo de visión), ' +
      'la precisión esperada en cada marca y los avisos. Es lo que usa la pantalla de configuración mientras se edita.',
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      fabrica: { summary: 'Los valores de fábrica', value: EJEMPLOS.configuracion },
      invalida: { summary: 'Inválida: devuelve los errores', value: EJEMPLOS.configuracionInvalida },
    },
  })
  @ApiOkResponse({ description: '`{ errores, derivados, precision, avisos }`' })
  analizarConfiguracion(@Body() cuerpo: unknown) {
    return this.analizar.execute(cuerpo)
  }
}
