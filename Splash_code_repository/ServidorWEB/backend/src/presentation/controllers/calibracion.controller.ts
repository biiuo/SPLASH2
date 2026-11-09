import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, StreamableFile } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import type {
  ActualizarCalibracionEntrada,
  EvaluarCalibracionEntrada,
  GuardarCalibracionEntrada,
} from '../../application/dtos/calibracion.dto'
import { ActivarCalibracionUseCase } from '../../application/use-cases/calibracion/activar-calibracion.usecase'
import { ActualizarCalibracionUseCase } from '../../application/use-cases/calibracion/actualizar-calibracion.usecase'
import { ObtenerImagenCalibracionUseCase } from '../../application/use-cases/calibracion/obtener-imagen.usecase'
import { ObtenerZonasUseCase } from '../../application/use-cases/calibracion/obtener-zonas.usecase'
import { ListarCalibracionesUseCase } from '../../application/use-cases/calibracion/listar-calibraciones.usecase'
import { EvaluarCalibracionUseCase } from '../../application/use-cases/calibracion/evaluar-calibracion.usecase'
import { GuardarCalibracionUseCase } from '../../application/use-cases/calibracion/guardar-calibracion.usecase'
import { ObtenerCalibracionActivaUseCase } from '../../application/use-cases/calibracion/obtener-calibracion-activa.usecase'
import { ObtenerPuntosReferenciaUseCase } from '../../application/use-cases/calibracion/obtener-puntos-referencia.usecase'
import type { Rol, Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { PermiteServicio, Roles, Solicitante, idDe } from '../auth/decoradores'
import { EJEMPLOS } from '../swagger/ejemplos'

const SIN_BASE = { description: 'La base de datos no está disponible.' }

/** Calibrar la cámara y dibujar las zonas: lo hace el entrenador (o un administrador). Ver, cualquiera con sesión. */
const CALIBRAN: Rol[] = ['entrenador', 'administrador']

@ApiTags('Calibración')
@ApiUnauthorizedResponse({ description: 'Sin sesión iniciada.' })
@ApiForbiddenResponse({ description: 'Calibrar y editar zonas: solo entrenadores y administradores.' })
@Controller('calibracion')
export class CalibracionController {
  constructor(
    private readonly puntosReferencia: ObtenerPuntosReferenciaUseCase,
    private readonly evaluarCalibracion: EvaluarCalibracionUseCase,
    private readonly guardarCalibracion: GuardarCalibracionUseCase,
    private readonly calibracionActiva: ObtenerCalibracionActivaUseCase,
    private readonly listarCalibraciones: ListarCalibracionesUseCase,
    private readonly activarCalibracion: ActivarCalibracionUseCase,
    private readonly actualizarCalibracion: ActualizarCalibracionUseCase,
    private readonly obtenerZonas: ObtenerZonasUseCase,
    private readonly obtenerImagen: ObtenerImagenCalibracionUseCase,
  ) {}

  /** Los puntos que hay que marcar en la imagen, según la piscina configurada. */
  @Get('puntos-referencia')
  @Roles(...CALIBRAN)
  @ApiOperation({
    summary: 'Los puntos que hay que marcar en la imagen',
    description:
      'Según la piscina configurada: cada punto con su posición real en metros, su nombre y una ayuda. ' +
      'También trae la geometría y los umbrales de error (bueno / aceptable).',
  })
  @ApiOkResponse({ description: '`{ geometria, anchoTotal_m, puntos, umbrales_error_m }`' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  obtenerPuntosReferencia() {
    return this.puntosReferencia.execute()
  }

  /** Evalúa los puntos marcados hasta ahora (cuántos faltan, calidad, siguiente punto). No guarda nada. */
  @Post('evaluar')
  @Roles(...CALIBRAN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Evaluar los puntos marcados (no guarda nada)',
    description:
      'Dice cuántos puntos faltan, cuál es el siguiente, qué tan buena es la calibración y qué punto está peor ubicado. ' +
      'Si se manda `image_size` y ya se puede calcular, devuelve también el archivo de calibración listo para guardar.\n\n' +
      '`px` es la posición del punto en la imagen, en píxeles. Los ejemplos usan una cámara inventada.',
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      sinMarcas: { summary: 'Sin marcas: dice cuál es el primer punto', value: EJEMPLOS.evaluarSinMarcas },
      parcial: { summary: '6 puntos: se puede calcular pero está incompleto', value: EJEMPLOS.evaluarParcial },
      completa: { summary: 'Los 12 puntos: calibración completa, con archivo', value: EJEMPLOS.evaluarCompleta },
    },
  })
  @ApiOkResponse({ description: '`{ evaluacion, archivo }`. `evaluacion.Hinv` es la inversa de la homografía (para dibujar sobre la imagen).' })
  @ApiBadRequestResponse({ description: 'Las marcas están mal formadas.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  evaluar(@Body() cuerpo: EvaluarCalibracionEntrada) {
    return this.evaluarCalibracion.execute(cuerpo)
  }

  /** La calibración activa, o null si todavía no hay ninguna. */
  @Get()
  @PermiteServicio()
  @ApiOperation({ summary: 'La calibración activa', description: 'Devuelve `null` si todavía no se guardó ninguna.' })
  @ApiOkResponse({ description: 'La calibración activa (homografía, puntos, geometría y error) o `null`.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  async obtenerActiva() {
    return (await this.calibracionActiva.execute()) ?? null
  }

  /** El historial de calibraciones, para poder elegir una. */
  @Get('historial')
  @ApiOperation({
    summary: 'Las calibraciones guardadas',
    description: 'De la más nueva a la más vieja, con su calidad y cuál está activa. Para volver a una anterior, usá `POST /api/calibracion/{id}/activar`.',
  })
  @ApiOkResponse({ description: 'Lista de `{ id, nombre, image_size, creada, completa, rmse_m, cruzado_m, n_puntos, zonas, activa }` (`zonas` = nombres).' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  historial() {
    return this.listarCalibraciones.execute()
  }

  /** Deja una calibración guardada como la activa. */
  @Post(':id/activar')
  @Roles(...CALIBRAN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Activar una calibración guardada',
    description: 'Las sesiones nuevas usan la activa. Las que ya empezaron siguen con la que tenían.',
  })
  @ApiParam({ name: 'id', description: 'Id de una calibración del historial.' })
  @ApiOkResponse({ description: '`{ id }`' })
  @ApiNotFoundResponse({ description: 'No existe esa calibración.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  activar(@Param('id') id: string) {
    return this.activarCalibracion.execute(id)
  }

  /** Las zonas de una calibración, en el formato de zones.json (lo que lee el servidor de IA). */
  @Get(':id/zonas')
  @PermiteServicio()
  @ApiOperation({
    summary: 'Las zonas de una calibración, como zones.json',
    description:
      'Devuelve `{ image_size, zones }`, o `null` si esa calibración todavía no tiene zonas. El servidor de IA lo pide al ' +
      'unirse a una sesión, con el `calibracion_id` de la sesión: así usa las zonas de la posición de cámara con la que empezó.',
  })
  @ApiParam({ name: 'id', description: 'Id de una calibración del historial.' })
  @ApiOkResponse({ description: '`{ image_size: [ancho, alto], zones: [{ name, polygon }] }` o `null`.' })
  @ApiNotFoundResponse({ description: 'No existe esa calibración.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  async zonas(@Param('id') id: string) {
    return (await this.obtenerZonas.execute(id)) ?? null
  }

  /** La imagen sobre la que se calibró (para dibujar las zonas o corregir la calibración sin volver a subirla). */
  @Get(':id/imagen')
  @Roles(...CALIBRAN)
  @Header('Cache-Control', 'private, max-age=3600')
  @ApiProduces('image/jpeg')
  @ApiOperation({ summary: 'La imagen sobre la que se calibró', description: 'JPEG. 404 si esa calibración no tiene imagen guardada.' })
  @ApiParam({ name: 'id', description: 'Id de una calibración del historial.' })
  @ApiOkResponse({ description: 'La imagen (image/jpeg).' })
  @ApiNotFoundResponse({ description: 'No existe esa calibración o no tiene imagen.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  async imagen(@Param('id') id: string) {
    return new StreamableFile(await this.obtenerImagen.execute(id), { type: 'image/jpeg' })
  }

  /** Cambia el nombre o las zonas de una calibración guardada. */
  @Patch(':id')
  @Roles(...CALIBRAN)
  @ApiOperation({
    summary: 'Cambiar el nombre o las zonas de una calibración',
    description:
      'Lo que no se mande queda igual; `null` lo borra. Las zonas son polígonos en píxeles de la imagen de esa calibración. ' +
      'Los carriles se llaman `lane<N>` (o `carril<N>`) y N tiene que ser uno de los carriles analizados. ' +
      'La homografía no cambia: para recalibrar, guardá una calibración nueva.',
  })
  @ApiParam({ name: 'id', description: 'Id de una calibración del historial.' })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      zonas: { summary: 'Guardar las zonas de los 3 carriles', value: { zonas: EJEMPLOS.zonas } },
      nombre: { summary: 'Ponerle nombre', value: { nombre: 'Tribuna, lado norte' } },
      borrarZonas: { summary: 'Borrar las zonas', value: { zonas: null } },
    },
  })
  @ApiOkResponse({ description: '`{ id, nombre, zonas, completa, rmse_m, cruzado_m }` (`zonas` = nombres).' })
  @ApiBadRequestResponse({ description: 'Las zonas o el nombre no son válidos. `errores` dice qué zona y por qué.' })
  @ApiNotFoundResponse({ description: 'No existe esa calibración.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  actualizar(@Param('id') id: string, @Body() cuerpo: ActualizarCalibracionEntrada) {
    return this.actualizarCalibracion.execute(id, cuerpo)
  }

  /** Guarda una calibración nueva y la deja activa. La homografía la calcula el servidor. */
  @Post()
  @Roles(...CALIBRAN)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Guardar una calibración nueva',
    description:
      'Calcula la homografía en el servidor a partir de los puntos (no acepta una matriz calculada afuera) y deja esta ' +
      'calibración como la activa. La anterior queda en el historial. Hacen falta al menos 4 puntos que no estén en línea.\n\n' +
      'Opcional: `nombre` (para reconocer la posición de la cámara) y `zonas` (también se pueden agregar después con PATCH).',
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      completa: { summary: 'Los 12 puntos', value: EJEMPLOS.guardarCalibracion },
      incompleta: { summary: 'Solo 2 puntos: responde 400', value: { image_size: [1280, 960], marcas: EJEMPLOS.evaluarParcial.marcas.slice(0, 2) } },
    },
  })
  @ApiCreatedResponse({ description: '`{ id, nombre, zonas, completa, rmse_m, cruzado_m }`' })
  @ApiBadRequestResponse({ description: 'Todavía no se puede calcular (faltan puntos, o están en línea). `errores` lo explica.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  guardar(@Body() cuerpo: GuardarCalibracionEntrada, @Solicitante() s: TipoSolicitante) {
    return this.guardarCalibracion.execute(cuerpo, idDe(s))
  }
}
