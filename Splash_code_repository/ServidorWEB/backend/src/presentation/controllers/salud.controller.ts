import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { Publico } from '../auth/decoradores'

@ApiTags('Salud')
@Publico()
@Controller('salud')
export class SaludController {
  /** Para saber si el servicio está vivo (lo usan Docker y el balanceador). No toca la base de datos. */
  @Get()
  @ApiOperation({ summary: 'El servicio está vivo', description: 'No consulta la base de datos: sirve para saber si la API responde.' })
  @ApiOkResponse({ description: '`{ estado: "ok" }`' })
  estado() {
    return { estado: 'ok' }
  }
}
