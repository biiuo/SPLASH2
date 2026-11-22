import { Injectable } from '@nestjs/common'

import type { Objetivo } from '../../domain/entities/objetivo.entity'
import type { DatosObjetivo, ObjetivoRepository } from '../../domain/repositories/objetivo.repository'
import { PrismaService } from '../persistence/prisma.service'

const CON_NOMBRES = { nadador: { select: { nombre: true, usuario_id: true } }, entrenador: { select: { nombre: true } } } as const
const dia = (d: Date) => d.toISOString().slice(0, 10)
const fecha = (s: string) => new Date(`${s}T00:00:00.000Z`)

type Fila = {
  id: string
  nadador_id: string
  entrenador_id: string | null
  tipo: Objetivo['tipo']
  meta: { toNumber(): number }
  desde: Date
  hasta: Date
  descripcion: string | null
  creado_en: Date
  nadador: { nombre: string; usuario_id: string | null }
  entrenador: { nombre: string } | null
}
const aObjetivo = (f: Fila): Objetivo => ({
  id: f.id,
  nadador_id: f.nadador_id,
  nadador: f.nadador.nombre,
  usuario_id: f.nadador.usuario_id,
  entrenador_id: f.entrenador_id,
  entrenador: f.entrenador?.nombre ?? null,
  tipo: f.tipo,
  meta: f.meta.toNumber(),
  desde: dia(f.desde),
  hasta: dia(f.hasta),
  descripcion: f.descripcion,
  creado_en: f.creado_en.toISOString(),
})

@Injectable()
export class PrismaObjetivoRepository implements ObjetivoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deNadadores(nadadorIds: string[] | null): Promise<Objetivo[]> {
    const filas = await this.prisma.objetivo.findMany({
      where: nadadorIds ? { nadador_id: { in: nadadorIds } } : {},
      orderBy: [{ hasta: 'desc' }, { creado_en: 'desc' }],
      include: CON_NOMBRES,
    })
    return filas.map(aObjetivo)
  }

  async obtener(id: string): Promise<Objetivo | null> {
    const f = await this.prisma.objetivo.findUnique({ where: { id }, include: CON_NOMBRES })
    return f ? aObjetivo(f) : null
  }

  async crear(nadadorId: string, entrenadorId: string, d: DatosObjetivo): Promise<Objetivo> {
    const f = await this.prisma.objetivo.create({
      data: { nadador_id: nadadorId, entrenador_id: entrenadorId, tipo: d.tipo, meta: d.meta, desde: fecha(d.desde), hasta: fecha(d.hasta), descripcion: d.descripcion },
      include: CON_NOMBRES,
    })
    return aObjetivo(f)
  }

  async actualizar(id: string, d: Partial<DatosObjetivo>): Promise<Objetivo> {
    const f = await this.prisma.objetivo.update({
      where: { id },
      data: {
        tipo: d.tipo,
        meta: d.meta,
        desde: d.desde ? fecha(d.desde) : undefined,
        hasta: d.hasta ? fecha(d.hasta) : undefined,
        descripcion: d.descripcion,
      },
      include: CON_NOMBRES,
    })
    return aObjetivo(f)
  }

  async borrar(id: string): Promise<void> {
    await this.prisma.objetivo.delete({ where: { id } })
  }
}
