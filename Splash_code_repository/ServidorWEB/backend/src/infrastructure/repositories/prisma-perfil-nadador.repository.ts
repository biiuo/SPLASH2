import { Injectable } from '@nestjs/common'

import type { Estilo, NuevoTiempo, PerfilGuardado, RespuestasPerfil, TiempoPersonal } from '../../domain/entities/perfil-nadador.entity'
import type { CambiosPerfil, PerfilNadadorRepository } from '../../domain/repositories/perfil-nadador.repository'
import type { Prisma } from '../persistence/generated/prisma/client'
import { PrismaService } from '../persistence/prisma.service'

const dia = (d: Date) => d.toISOString().slice(0, 10)

type FilaPerfil = { nadador_id: string; respuestas: unknown; etapa: number; omitido: boolean; completado_en: Date | null; actualizado_en: Date }
const aPerfil = (f: FilaPerfil): PerfilGuardado => ({
  nadador_id: f.nadador_id,
  respuestas: (f.respuestas && typeof f.respuestas === 'object' ? f.respuestas : {}) as RespuestasPerfil,
  etapa: f.etapa,
  omitido: f.omitido,
  completado_en: f.completado_en?.toISOString() ?? null,
  actualizado_en: f.actualizado_en.toISOString(),
})

type FilaTiempo = { id: string; estilo: string; distancia_m: number; piscina_m: number; tiempo_ms: number; fecha: Date; creado_en: Date }
const aTiempo = (f: FilaTiempo): TiempoPersonal => ({
  id: f.id,
  estilo: f.estilo as Estilo,
  distancia_m: f.distancia_m,
  piscina_m: f.piscina_m,
  tiempo_ms: f.tiempo_ms,
  fecha: dia(f.fecha),
  creado_en: f.creado_en.toISOString(),
})

@Injectable()
export class PrismaPerfilNadadorRepository implements PerfilNadadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(nadadorId: string): Promise<PerfilGuardado | null> {
    const f = await this.prisma.perfilNadador.findUnique({ where: { nadador_id: nadadorId } })
    return f ? aPerfil(f) : null
  }

  guardar(nadadorId: string, c: CambiosPerfil): Promise<PerfilGuardado> {
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.perfilNadador.findUnique({ where: { nadador_id: nadadorId }, select: { completado_en: true } })
      const datos = {
        respuestas: c.respuestas as Prisma.InputJsonValue | undefined,
        etapa: c.etapa,
        omitido: c.omitido,
        // la fecha en que lo terminó es la primera; editar después no la cambia
        completado_en: c.completado && !actual?.completado_en ? new Date() : undefined,
        actualizado_en: new Date(),
      }
      const f = await tx.perfilNadador.upsert({
        where: { nadador_id: nadadorId },
        create: { nadador_id: nadadorId, ...datos, respuestas: datos.respuestas ?? {} },
        update: datos,
      })
      return aPerfil(f)
    })
  }

  async tiempos(nadadorId: string): Promise<TiempoPersonal[]> {
    const filas = await this.prisma.tiempoPersonal.findMany({ where: { nadador_id: nadadorId }, orderBy: [{ fecha: 'desc' }, { creado_en: 'desc' }] })
    return filas.map(aTiempo)
  }

  async agregarTiempo(nadadorId: string, t: NuevoTiempo): Promise<TiempoPersonal> {
    const f = await this.prisma.tiempoPersonal.create({
      data: { nadador_id: nadadorId, estilo: t.estilo, distancia_m: t.distancia_m, piscina_m: t.piscina_m, tiempo_ms: t.tiempo_ms, fecha: new Date(`${t.fecha}T00:00:00.000Z`) },
    })
    return aTiempo(f)
  }

  async borrarTiempo(nadadorId: string, id: string): Promise<boolean> {
    const r = await this.prisma.tiempoPersonal.deleteMany({ where: { id, nadador_id: nadadorId } })
    return r.count > 0
  }
}
