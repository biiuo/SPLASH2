import { Configuracion } from '../../domain/entities/configuracion.entity'
import type { Prisma, Configuracion as FilaConfiguracion } from '../persistence/generated/prisma/client'

/** Traduce entre la entidad del dominio y la fila de la base de datos. */
export class ConfiguracionMapper {
  static toDomain(fila: Pick<FilaConfiguracion, 'piscina' | 'camara' | 'procesamiento'>): Configuracion {
    return Configuracion.desde({ piscina: fila.piscina, camara: fila.camara, procesamiento: fila.procesamiento })
  }

  static toPrisma(
    c: Configuracion,
    usuarioId: string | null,
  ): { piscina: Prisma.InputJsonValue; camara: Prisma.InputJsonValue; procesamiento: Prisma.InputJsonValue; actualizada_por: string | null } {
    return {
      piscina: c.piscina as unknown as Prisma.InputJsonValue,
      camara: c.camara as unknown as Prisma.InputJsonValue,
      procesamiento: c.procesamiento as unknown as Prisma.InputJsonValue,
      actualizada_por: usuarioId,
    }
  }
}
