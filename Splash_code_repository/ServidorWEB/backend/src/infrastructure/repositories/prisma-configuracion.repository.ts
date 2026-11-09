import { Injectable } from '@nestjs/common'

import type { Configuracion } from '../../domain/entities/configuracion.entity'
import type { ConfiguracionRepository } from '../../domain/repositories/configuracion.repository'
import { ConfiguracionMapper } from '../mappers/configuracion.mapper'
import { PrismaService } from '../persistence/prisma.service'

@Injectable()
export class PrismaConfiguracionRepository implements ConfiguracionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<Configuracion | null> {
    const fila = await this.prisma.configuracion.findUnique({ where: { id: true } })
    return fila ? ConfiguracionMapper.toDomain(fila) : null
  }

  async guardar(configuracion: Configuracion, usuarioId: string | null = null): Promise<Configuracion> {
    const datos = ConfiguracionMapper.toPrisma(configuracion, usuarioId)
    // una sola fila (id = true): si ya existe se actualiza
    await this.prisma.configuracion.upsert({
      where: { id: true },
      create: { id: true, ...datos },
      update: { ...datos, actualizada_en: new Date() },
    })
    return configuracion
  }
}
