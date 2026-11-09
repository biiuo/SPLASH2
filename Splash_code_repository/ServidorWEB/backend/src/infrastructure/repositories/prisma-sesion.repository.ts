import { Injectable } from '@nestjs/common'

import type { ResumenSesion, Sesion } from '../../domain/entities/sesion.entity'
import { ConflictoCarriles, type NuevaSesion, type SesionRepository } from '../../domain/repositories/sesion.repository'
import { PrismaService } from '../persistence/prisma.service'
import type { Prisma, Sesion as FilaSesion } from '../persistence/generated/prisma/client'

/** Las sesiones que esa persona puede ver: las que inició, o aquellas en las que le asignaron un carril (como nadador). */
const visiblesPara = (usuarioId: string): Prisma.SesionWhereInput => ({
  OR: [{ entrenador_id: usuarioId }, { nadadores: { some: { nadador: { usuario_id: usuarioId } } } }],
})

/** Lo que se trae junto con cada sesión: sus carriles y el nadador de cada uno. */
const CON_CARRILES = {
  nadadores: { orderBy: { carril: 'asc' }, include: { nadador: { select: { nombre: true, usuario_id: true } } } },
  entrenador: { select: { nombre: true, rol: true } },
  grupo: { select: { nombre: true } },
} as const satisfies Prisma.SesionInclude

type FilaConCarriles = FilaSesion & {
  nadadores: { carril: number; nadador_id: string | null; nadador: { nombre: string; usuario_id: string | null } | null }[]
  entrenador: { nombre: string; rol: 'administrador' | 'entrenador' | 'nadador' } | null
  grupo: { nombre: string } | null
}

const aDominio = (f: FilaConCarriles): Sesion => ({
  id: f.id,
  estado: f.estado,
  modo: f.modo,
  calibracion_id: f.calibracion_id,
  iniciada_por_id: f.entrenador_id,
  iniciada_por: f.entrenador?.nombre ?? null,
  iniciada_por_rol: f.entrenador?.rol ?? null,
  grupo_id: f.grupo_id,
  grupo: f.grupo?.nombre ?? null,
  carriles: f.nadadores.map((n) => ({
    carril: n.carril,
    nadador_id: n.nadador_id,
    nadador: n.nadador?.nombre ?? null,
    usuario_id: n.nadador?.usuario_id ?? null,
  })),
  inicio: f.inicio.toISOString(),
  fin: f.fin ? f.fin.toISOString() : null,
})

/** Un índice único de la base saltó: otro pedido tomó el carril, el nadador, o ya hay una sesión de esa persona. */
function esConflicto(e: unknown): boolean {
  const x = e as { code?: string; message?: string; cause?: { code?: string } }
  return x?.code === 'P2002' || x?.cause?.code === '23505' || /unique|duplicate key|23505/i.test(String(x?.message ?? ''))
}

@Injectable()
export class PrismaSesionRepository implements SesionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async iniciar(datos: NuevaSesion): Promise<Sesion> {
    try {
      const fila = await this.prisma.sesion.create({
        data: {
          modo: datos.modo,
          calibracion_id: datos.calibracionId,
          entrenador_id: datos.usuarioId,
          grupo_id: datos.grupoId,
          nadadores: { create: datos.carriles.map((c) => ({ carril: c.carril, nadador_id: c.nadadorId, activo: true })) },
        },
        include: CON_CARRILES,
      })
      return aDominio(fila)
    } catch (e) {
      if (esConflicto(e)) throw new ConflictoCarriles()
      throw e
    }
  }

  async obtener(id: string): Promise<Sesion | null> {
    const fila = await this.prisma.sesion.findUnique({ where: { id }, include: CON_CARRILES })
    return fila ? aDominio(fila) : null
  }

  async obtenerActiva(visiblePara: string | null = null): Promise<Sesion | null> {
    const fila = await this.prisma.sesion.findFirst({
      where: { estado: 'activa', ...(visiblePara ? visiblesPara(visiblePara) : {}) },
      orderBy: { inicio: 'desc' },
      include: CON_CARRILES,
    })
    return fila ? aDominio(fila) : null
  }

  async obtenerActivas(): Promise<Sesion[]> {
    const filas = await this.prisma.sesion.findMany({ where: { estado: 'activa' }, orderBy: { inicio: 'asc' }, include: CON_CARRILES })
    return filas.map(aDominio)
  }

  async activaIniciadaPor(usuarioId: string): Promise<Sesion | null> {
    const fila = await this.prisma.sesion.findFirst({ where: { estado: 'activa', entrenador_id: usuarioId }, include: CON_CARRILES })
    return fila ? aDominio(fila) : null
  }

  async puedeVer(sesionId: string, usuarioId: string): Promise<boolean> {
    return (await this.prisma.sesion.count({ where: { id: sesionId, ...visiblesPara(usuarioId) } })) > 0
  }

  async asignarCarril(sesionId: string, carril: number, nadadorId: string): Promise<Sesion> {
    try {
      await this.prisma.sesionNadador.upsert({
        where: { sesion_id_carril: { sesion_id: sesionId, carril } },
        create: { sesion_id: sesionId, carril, nadador_id: nadadorId, activo: true },
        update: { nadador_id: nadadorId },
      })
    } catch (e) {
      if (esConflicto(e)) throw new ConflictoCarriles()
      throw e
    }
    return (await this.obtener(sesionId))!
  }

  async finalizar(id: string): Promise<Sesion | null> {
    await this.prisma.$transaction([
      this.prisma.sesion.updateMany({ where: { id, estado: 'activa' }, data: { estado: 'finalizada', fin: new Date() } }),
      // los carriles quedan libres para otras sesiones
      this.prisma.sesionNadador.updateMany({ where: { sesion_id: id, activo: true }, data: { activo: false } }),
    ])
    return this.obtener(id)
  }

  async listarRecientes(limite: number, visiblePara: string | null = null): Promise<ResumenSesion[]> {
    const filas = await this.prisma.sesion.findMany({
      where: visiblePara ? visiblesPara(visiblePara) : {},
      orderBy: { inicio: 'desc' },
      take: limite,
      include: {
        entrenador: { select: { nombre: true, rol: true } },
        grupo: { select: { nombre: true } },
        nadadores: { select: { carril: true, nadador: { select: { usuario_id: true } } } },
      },
    })
    if (!filas.length) return []
    const ids = filas.map((f) => f.id)
    // de las sesiones que NO inició, un nadador ve solo lo de su carril (no lo de los demás del grupo)
    const suyos = new Map<string, Set<number>>()
    if (visiblePara) {
      for (const f of filas) {
        if (f.entrenador_id === visiblePara) continue
        suyos.set(f.id, new Set(f.nadadores.filter((n) => n.nadador?.usuario_id === visiblePara).map((n) => n.carril)))
      }
    }
    // tramos de esas sesiones: lo justo para el resumen (no se traen los eventos)
    const tramos = await this.prisma.tramo.findMany({
      where: { sesion_id: { in: ids } },
      select: { sesion_id: true, carril: true, distancia_m: true, t_inicio: true, t_fin: true },
    })
    const porSesion = new Map<string, { carriles: Set<number>; tramos: number; metros: number; segundos: number }>()
    for (const t of tramos) {
      const permitidos = suyos.get(t.sesion_id)
      if (permitidos && !permitidos.has(t.carril)) continue
      const r = porSesion.get(t.sesion_id) ?? { carriles: new Set<number>(), tramos: 0, metros: 0, segundos: 0 }
      r.carriles.add(t.carril)
      r.tramos += 1
      r.metros += t.distancia_m.toNumber()
      r.segundos += (t.t_fin.getTime() - t.t_inicio.getTime()) / 1000
      porSesion.set(t.sesion_id, r)
    }
    return filas.map((f) => {
      const r = porSesion.get(f.id)
      const { carriles: _carriles, ...base } = aDominio({ ...f, nadadores: [] })
      return {
        ...base,
        carriles: r ? [...r.carriles].sort((a, b) => a - b) : [],
        tramos: r?.tramos ?? 0,
        distancia_m: r ? Math.round(r.metros * 100) / 100 : 0,
        velocidad_media_ms: r && r.segundos > 0 ? Math.round((r.metros / r.segundos) * 1000) / 1000 : null,
      }
    })
  }
}
