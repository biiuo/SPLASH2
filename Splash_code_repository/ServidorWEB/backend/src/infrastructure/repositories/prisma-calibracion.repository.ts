import { Injectable } from '@nestjs/common'

import type { ArchivoCalibracion, CalibracionGuardada } from '../../domain/entities/calibracion.entity'
import type { CalibracionRepository, CalibracionResumen, ExtrasCalibracion } from '../../domain/repositories/calibracion.repository'
import { CalibracionMapper } from '../mappers/calibracion.mapper'
import { PrismaService } from '../persistence/prisma.service'

/** La imagen pesa (cientos de KB): no se trae en las consultas normales, solo en obtenerImagen. */
const SIN_IMAGEN = { imagen: true } as const

@Injectable()
export class PrismaCalibracionRepository implements CalibracionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** En una sola transacción: la anterior deja de ser la activa y entra la nueva (si algo falla, no queda nada a medias). */
  guardar(calibracion: ArchivoCalibracion, usuarioId: string | null = null, extras: ExtrasCalibracion = {}): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.calibracion.updateMany({ where: { activa: true }, data: { activa: false } })
      return tx.calibracion.create({ data: CalibracionMapper.toPrismaCreate(calibracion, usuarioId, extras), select: { id: true } })
    })
  }

  async obtenerActiva(): Promise<CalibracionGuardada | null> {
    const fila = await this.prisma.calibracion.findFirst({ where: { activa: true }, omit: SIN_IMAGEN })
    return fila ? CalibracionMapper.toDomain(fila) : null
  }

  async obtener(id: string): Promise<CalibracionGuardada | null> {
    const fila = await this.prisma.calibracion.findUnique({ where: { id }, omit: SIN_IMAGEN })
    return fila ? CalibracionMapper.toDomain(fila) : null
  }

  async listar(): Promise<CalibracionResumen[]> {
    const [filas, conImagen] = await Promise.all([
      this.prisma.calibracion.findMany({ orderBy: { creado_en: 'desc' }, omit: SIN_IMAGEN }),
      this.prisma.calibracion.findMany({ where: { imagen: { not: null } }, select: { id: true } }),
    ])
    const tienen = new Set(conImagen.map((c) => c.id))
    return filas.map((f) => CalibracionMapper.toResumen(f, tienen.has(f.id)))
  }

  /** En una transacción: la que estaba activa deja de serlo y esta pasa a serlo (el índice único parcial lo exige así). */
  activar(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await tx.calibracion.findUnique({ where: { id }, select: { id: true } }))) return false
      await tx.calibracion.updateMany({ where: { activa: true }, data: { activa: false } })
      await tx.calibracion.update({ where: { id }, data: { activa: true } })
      return true
    })
  }

  async actualizar(id: string, cambios: ExtrasCalibracion): Promise<CalibracionGuardada | null> {
    const r = await this.prisma.calibracion.updateManyAndReturn({ where: { id }, data: CalibracionMapper.toPrismaUpdate(cambios), omit: SIN_IMAGEN })
    return r[0] ? CalibracionMapper.toDomain(r[0]) : null
  }

  async obtenerImagen(id: string): Promise<Uint8Array | null> {
    const fila = await this.prisma.calibracion.findUnique({ where: { id }, select: { imagen: true } })
    return fila?.imagen ?? null
  }
}
