import { Injectable } from '@nestjs/common'

import type { Latido, LatidoRepository } from '../../domain/repositories/latido.repository'
import type { Prisma } from '../persistence/generated/prisma/client'
import { PrismaService } from '../persistence/prisma.service'

@Injectable()
export class PrismaLatidoRepository implements LatidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Una fila por componente: cada latido la pisa (upsert), así la tabla no crece. */
  async registrar(componente: string, estado: Record<string, unknown>): Promise<void> {
    const valor = estado as Prisma.InputJsonValue
    await this.prisma.latido.upsert({
      where: { componente },
      create: { componente, estado: valor, ultimo_latido: new Date() },
      update: { estado: valor, ultimo_latido: new Date() },
    })
  }

  async listar(): Promise<Latido[]> {
    const filas = await this.prisma.latido.findMany({ orderBy: { componente: 'asc' } })
    return filas.map((f) => ({
      componente: f.componente,
      estado: (f.estado ?? {}) as Record<string, unknown>,
      ultimo_latido: f.ultimo_latido.toISOString(),
    }))
  }
}
