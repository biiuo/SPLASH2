import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Sse, type MessageEvent } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { Observable, concatMap, defer, filter, interval, map, merge } from 'rxjs'

import type { IniciarSesionEntrada, RecibirTrayectoriasEntrada, UnirseSesionEntrada } from '../../application/dtos/sesion.dto'
import { ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import { CANAL_AVISOS, type AvisoSesion, type CanalAvisos } from '../../application/ports/avisos.ports'
import { EstadoCarrilesUseCase } from '../../application/use-cases/sesiones/estado-carriles.usecase'
import { FinalizarSesionUseCase } from '../../application/use-cases/sesiones/finalizar-sesion.usecase'
import { IniciarSesionUseCase } from '../../application/use-cases/sesiones/iniciar-sesion.usecase'
import { ListarSesionesUseCase } from '../../application/use-cases/sesiones/listar-sesiones.usecase'
import { ObtenerResultadosUseCase, carrilesVisibles } from '../../application/use-cases/sesiones/obtener-resultados.usecase'
import { ObtenerSesionActivaUseCase } from '../../application/use-cases/sesiones/obtener-sesion-activa.usecase'
import { RecibirTrayectoriasUseCase } from '../../application/use-cases/sesiones/recibir-trayectorias.usecase'
import { RepartirTrayectoriasUseCase } from '../../application/use-cases/sesiones/repartir-trayectorias.usecase'
import { UnirseSesionUseCase } from '../../application/use-cases/sesiones/unirse-sesion.usecase'
import type { Sesion } from '../../domain/entities/sesion.entity'
import type { Identidad, Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'
import { SESION_REPOSITORY, type SesionRepository } from '../../domain/repositories/sesion.repository'
import { duenoRequerido, visibilidadDe } from '../../domain/services/acceso-sesiones'
import { PermiteServicio, Solicitante } from '../auth/decoradores'
import { EJEMPLOS } from '../swagger/ejemplos'

const SIN_BASE = { description: 'La base de datos no está disponible.' }
const ID_SESION = { name: 'id', description: 'Id de la sesión (el que devolvió POST /api/sesiones).' }

/** La persona que hace el pedido (las rutas sin @PermiteServicio siempre la tienen). */
function persona(s: TipoSolicitante): Identidad {
  if (s.tipo !== 'usuario') throw new ProhibidoException('Esta ruta es para personas.')
  return { id: s.id, rol: s.rol, nombre: s.nombre }
}
const personaO = (s: TipoSolicitante): Identidad | null => (s.tipo === 'usuario' ? persona(s) : null)

@ApiTags('Sesiones')
@ApiUnauthorizedResponse({ description: 'Sin sesión iniciada.' })
@Controller('sesiones')
export class SesionesController {
  constructor(
    private readonly iniciar: IniciarSesionUseCase,
    private readonly unirse: UnirseSesionUseCase,
    private readonly carriles: EstadoCarrilesUseCase,
    private readonly activa: ObtenerSesionActivaUseCase,
    private readonly trayectorias: RecibirTrayectoriasUseCase,
    private readonly repartir: RepartirTrayectoriasUseCase,
    private readonly finalizar: FinalizarSesionUseCase,
    private readonly resultados: ObtenerResultadosUseCase,
    private readonly listar: ListarSesionesUseCase,
    @Inject(SESION_REPOSITORY) private readonly sesiones: SesionRepository,
    @Inject(CANAL_AVISOS) private readonly avisos: CanalAvisos,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Iniciar una sesión',
    description:
      'Abre una sesión en uno o más carriles, con la calibración activa. Puede haber varias sesiones a la vez, cada una en sus ' +
      'carriles. Un **entrenador** elige los carriles y, en cada uno, un nadador de su grupo (`nadador_id`) o ninguno (queda ' +
      'reservado para quien llegue después). Un **nadador** abre su sesión libre en **un** carril libre. `modo` dice dónde se ' +
      'procesa el video; si no viene, el de la configuración.',
  })
  @ApiBody({ schema: { type: 'object' }, examples: { entrenador: { summary: 'Entrenador: carriles 4 y 5', value: EJEMPLOS.iniciarSesion } } })
  @ApiCreatedResponse({ description: 'La sesión creada, con sus carriles.' })
  @ApiBadRequestResponse({ description: 'Carril inválido o repetido, un nadador que no es del grupo, o no hay calibración activa.' })
  @ApiConflictResponse({ description: 'Un carril ya está en uso, el nadador ya está en otra sesión, o ya tenés una sesión en curso.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  iniciarSesion(@Body() cuerpo: IniciarSesionEntrada, @Solicitante() s: TipoSolicitante) {
    return this.iniciar.execute(cuerpo, persona(s))
  }

  @Post(':id/unirse')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sumarse a la sesión del entrenador',
    description:
      'Un nadador que llega tarde se suma a la sesión en curso de su entrenador: en un carril de la sesión sin nadador, o en ' +
      'un carril libre de la piscina (que pasa a ser de esa sesión).',
  })
  @ApiParam(ID_SESION)
  @ApiBody({ schema: { type: 'object' }, examples: { carril6: { summary: 'Carril 6', value: { carril: 6 } } } })
  @ApiOkResponse({ description: 'La sesión, con el carril asignado.' })
  @ApiForbiddenResponse({ description: 'No es un nadador, o no es la sesión de su entrenador.' })
  @ApiConflictResponse({ description: 'El carril ya tiene nadador o está en otra sesión, o ya está en una sesión.' })
  unirseSesion(@Param('id') id: string, @Body() cuerpo: UnirseSesionEntrada, @Solicitante() s: TipoSolicitante) {
    return this.unirse.execute(id, cuerpo, persona(s))
  }

  @Get('carriles')
  @ApiOperation({
    summary: 'Qué carriles están libres',
    description:
      'Cada carril analizado: `libre`, `mio` (en mi sesión, o es el mío), `grupo` (en la sesión de mi entrenador: si no tiene ' +
      'nadador me puedo sumar) u `ocupado` (otra sesión: no se dice de quién).',
  })
  @ApiOkResponse({ description: '`{ carriles: [{ carril, estado, sesion_id, con_nadador, nadador }], sesion_de_mi_entrenador }`' })
  estadoCarriles(@Solicitante() s: TipoSolicitante) {
    return this.carriles.execute(persona(s))
  }

  @Get()
  @ApiOperation({
    summary: 'Historial de sesiones',
    description:
      'Las últimas sesiones (la más reciente primero) con el resumen de lo medido. Cada persona ve solo las suyas: las que ' +
      'inició o aquellas en las que tiene un carril. El administrador ve todas.',
  })
  @ApiQuery({ name: 'limite', required: false, description: 'Cuántas sesiones (1 a 100, por defecto 20).' })
  @ApiOkResponse({ description: 'Lista de sesiones con su resumen.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  listarSesiones(@Query('limite') limite: string | undefined, @Solicitante() s: TipoSolicitante) {
    return this.listar.execute(limite, visibilidadDe(s))
  }

  @Get('activa')
  @PermiteServicio()
  @ApiOperation({
    summary: 'Mi sesión en curso',
    description: 'La sesión en curso de quien pregunta (la que inició, o en la que tiene un carril), o `null`.',
  })
  @ApiOkResponse({ description: 'La sesión, o `null`.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  async obtenerActiva(@Solicitante() s: TipoSolicitante) {
    return (await this.activa.execute(visibilidadDe(s))) ?? null
  }

  @Get('activas')
  @PermiteServicio()
  @ApiOperation({ summary: 'Todas las sesiones en curso', description: 'Para el servidor de IA y el administrador.' })
  @ApiOkResponse({ description: 'Lista de sesiones en curso, con sus carriles.' })
  @ApiForbiddenResponse({ description: 'Solo el administrador o el servidor de IA.' })
  async obtenerActivas(@Solicitante() s: TipoSolicitante) {
    if (visibilidadDe(s)) throw new ProhibidoException('Solo el administrador ve todas las sesiones.')
    return this.sesiones.obtenerActivas()
  }

  @Sse('eventos')
  @PermiteServicio()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Avisos en vivo (SSE)',
    description:
      'Conexión que queda abierta y por la que llegan avisos apenas pasan (Server-Sent Events). A cada uno le llegan solo los de ' +
      'sus sesiones, y a un nadador solo los resultados de su carril.\n\n' +
      '- `estado` — siempre el primero: `{ sesion }` (mi sesión en curso o `null`). Al servidor de IA y al administrador además ' +
      '`{ sesiones }`, todas las que están en curso.\n' +
      '- `sesion_iniciada` / `sesion_finalizada` — `{ sesion }`.\n' +
      '- `resultados` — `{ sesion_id, eventos, tramos }`: solo lo nuevo.\n' +
      '- `carriles` — cambió qué carriles están tomados (sin decir de quién): conviene volver a preguntar `GET /carriles`.\n' +
      '- `latido` — cada 20 s.',
  })
  @ApiOkResponse({ description: 'Flujo `text/event-stream`.' })
  avisosEnVivo(@Solicitante() s: TipoSolicitante): Observable<MessageEvent> {
    const quien = personaO(s)
    const filtrar = visibilidadDe(s) !== null
    /** Mis sesiones y qué carriles de cada una me corresponden (null = todos). */
    const mias = new Map<string, Set<number> | null>()
    const anotar = (sesion: Sesion | null) => {
      if (sesion) mias.set(sesion.id, carrilesVisibles(sesion, quien))
    }

    const pasar = async (aviso: AvisoSesion): Promise<AvisoSesion | null> => {
      if (!filtrar) return aviso
      switch (aviso.tipo) {
        case 'carriles':
          // quizás me sumaron a una sesión (o me sumé): se vuelve a mirar cuál es la mía
          anotar(await this.activa.execute(quien!.id))
          return aviso
        case 'sesion_iniciada': {
          if (!(await this.sesiones.puedeVer(aviso.sesion.id, quien!.id))) return null
          anotar(aviso.sesion)
          return aviso
        }
        case 'sesion_finalizada':
          return mias.delete(aviso.sesion.id) ? aviso : null
        case 'resultados': {
          if (!mias.has(aviso.sesion_id)) return null
          const carriles = mias.get(aviso.sesion_id)
          if (!carriles) return aviso
          const eventos = aviso.eventos.filter((e) => carriles.has(e.carril))
          const tramos = aviso.tramos.filter((t) => carriles.has(t.carril))
          return eventos.length || tramos.length ? { ...aviso, eventos, tramos } : null
        }
      }
    }

    // primero se escucha y después se consulta el estado: así no se pierde un aviso que llegue mientras tanto
    const cambios = new Observable<AvisoSesion>((suscriptor) => this.avisos.suscribir((a) => suscriptor.next(a))).pipe(
      concatMap(pasar),
      filter((aviso): aviso is AvisoSesion => aviso !== null),
      map((aviso): MessageEvent => ({ type: aviso.tipo, data: aviso })),
    )
    const estado = defer(async () => {
      if (!filtrar) {
        const sesiones = await this.sesiones.obtenerActivas()
        return { sesion: sesiones[0] ?? null, sesiones }
      }
      const sesion = await this.activa.execute(quien!.id)
      anotar(sesion)
      return { sesion }
    }).pipe(map((data): MessageEvent => ({ type: 'estado', data })))
    const latido = interval(20_000).pipe(map((): MessageEvent => ({ type: 'latido', data: {} })))
    return merge(cambios, estado, latido)
  }

  @Post('trayectorias')
  @PermiteServicio()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Posiciones de todos los carriles (servidor de IA)',
    description:
      'El servidor de IA mira todos los carriles a la vez y manda todo junto. Cada posición va a la sesión dueña de su carril; ' +
      'las de carriles libres, o de sesiones que procesa un celular, se descartan.',
  })
  @ApiBody({ schema: { type: 'object' }, examples: { nadaDe3a12m: { summary: 'Un nadador del metro 3 al 12', value: EJEMPLOS.trayectoria } } })
  @ApiOkResponse({ description: '`{ recibidas, por_sesion: [{ sesion_id, muestras, eventos, tramos }], sin_sesion }`' })
  @ApiForbiddenResponse({ description: 'Solo el servidor de IA o el administrador.' })
  repartirTrayectorias(@Body() cuerpo: RecibirTrayectoriasEntrada, @Solicitante() s: TipoSolicitante) {
    if (visibilidadDe(s)) throw new ProhibidoException('Solo el servidor de IA manda posiciones de todos los carriles.')
    return this.repartir.execute(cuerpo)
  }

  @Post(':id/trayectorias')
  @PermiteServicio()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enviar posiciones a una sesión',
    description:
      'Quien mide para una sesión (el celular de quien la inició) manda las posiciones en **píxeles**, con la hora de captura del ' +
      'frame. Solo se guardan las de los carriles de esa sesión. El servidor las convierte a metros, detecta cruces de marca, ' +
      'virajes, tramos y descansos. Reenviar un lote no duplica nada.',
  })
  @ApiParam(ID_SESION)
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      nadaDe3a12m: { summary: 'Un nadador del metro 3 al 12 (cruza las marcas de 5 y 10 m)', value: EJEMPLOS.trayectoria },
      malFormada: { summary: 'Carril que no se analiza: responde 400', value: EJEMPLOS.trayectoriaMalFormada },
    },
  })
  @ApiOkResponse({ description: '`{ recibidas, procesadas, descartadas, eventos, tramos }`' })
  @ApiBadRequestResponse({ description: 'Posiciones mal formadas, o la sesión ya terminó.' })
  @ApiNotFoundResponse({ description: 'No existe esa sesión.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  enviarTrayectorias(@Param('id') id: string, @Body() cuerpo: RecibirTrayectoriasEntrada, @Solicitante() s: TipoSolicitante) {
    return this.trayectorias.execute(id, cuerpo, duenoRequerido(s))
  }

  @Post(':id/finalizar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Finalizar una sesión', description: 'Solo quien la inició. Libera sus carriles. Si ya estaba finalizada la devuelve tal cual.' })
  @ApiParam(ID_SESION)
  @ApiOkResponse({ description: 'La sesión finalizada.' })
  @ApiNotFoundResponse({ description: 'No existe esa sesión.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  finalizarSesion(@Param('id') id: string, @Solicitante() s: TipoSolicitante) {
    return this.finalizar.execute(id, duenoRequerido(s))
  }

  @Get(':id/resultados')
  @ApiOperation({
    summary: 'Eventos y tramos de una sesión',
    description: 'En orden de tiempo. Un nadador ve solo los de su carril. `observado: false` = inferido (no se veía al nadador).',
  })
  @ApiParam(ID_SESION)
  @ApiOkResponse({ description: '`{ eventos, tramos }`' })
  @ApiNotFoundResponse({ description: 'No existe esa sesión.' })
  @ApiServiceUnavailableResponse(SIN_BASE)
  obtenerResultados(@Param('id') id: string, @Solicitante() s: TipoSolicitante) {
    return this.resultados.execute(id, personaO(s))
  }
}
