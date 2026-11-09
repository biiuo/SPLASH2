import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/prisma/client'

/** El cliente de Prisma como servicio de Nest. No se conecta al arrancar: si la base no está, la API arranca igual y responde 503. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('Falta la variable de entorno DATABASE_URL')
    super({ adapter: new PrismaPg({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) }) })
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
