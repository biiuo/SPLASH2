import { Injectable } from '@nestjs/common'

import type { ResultadosSesion } from '../../domain/entities/sesion.entity'
import type { EventoParaGuardar, ResultadosRepository, TramoParaGuardar } from '../../domain/repositories/resultados.repository'
import { PrismaService } from '../persistence/prisma.service'

@Injectable()
export class PrismaResultadosRepository implements ResultadosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async guardar(sesionId: string, eventos: EventoParaGuardar[], tramos: TramoParaGuardar[]): Promise<void> {
    if (!eventos.length && !tramos.length) return
    // skipDuplicates: si el celular reenvía un lote, los ids (deterministas) ya existen y no se duplica nada
    await this.prisma.$transaction([
      this.prisma.evento.createMany({
        skipDuplicates: true,
        data: eventos.map((e) => ({
          id: e.id,
          sesion_id: sesionId,
          carril: e.carril,
          identidad: e.identidad,
          tipo: e.tipo,
          nodo_m: e.nodo_m,
          ts_captura: new Date(Math.round(e.t)),
          observado: e.observado,
        })),
      }),
      this.prisma.tramo.createMany({
        skipDuplicates: true,
        data: tramos.map((t) => ({
          id: t.id,
          sesion_id: sesionId,
          carril: t.carril,
          identidad: t.identidad,
          nodo_desde_m: t.nodo_desde_m,
          nodo_hasta_m: t.nodo_hasta_m,
          t_inicio: new Date(Math.round(t.t_inicio)),
          t_fin: new Date(Math.round(t.t_fin)),
          distancia_m: t.distancia_m,
          velocidad_ms: Math.round(t.velocidad_ms * 1000) / 1000,
          observado: t.observado,
        })),
      }),
    ])
  }

  async listar(sesionId: string): Promise<ResultadosSesion> {
    const [eventos, tramos] = await Promise.all([
      this.prisma.evento.findMany({ where: { sesion_id: sesionId }, orderBy: { ts_captura: 'asc' } }),
      this.prisma.tramo.findMany({ where: { sesion_id: sesionId }, orderBy: { t_inicio: 'asc' } }),
    ])
    return {
      eventos: eventos.map((e) => ({
        id: e.id,
        carril: e.carril,
        identidad: e.identidad,
        tipo: e.tipo,
        nodo_m: e.nodo_m === null ? null : e.nodo_m.toNumber(),
        ts_captura: e.ts_captura.toISOString(),
        observado: e.observado,
      })),
      tramos: tramos.map((t) => ({
        id: t.id,
        carril: t.carril,
        identidad: t.identidad,
        nodo_desde_m: t.nodo_desde_m.toNumber(),
        nodo_hasta_m: t.nodo_hasta_m.toNumber(),
        t_inicio: t.t_inicio.toISOString(),
        t_fin: t.t_fin.toISOString(),
        distancia_m: t.distancia_m.toNumber(),
        velocidad_ms: t.velocidad_ms.toNumber(),
        observado: t.observado,
      })),
    }
  }
}
