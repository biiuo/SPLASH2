import { Injectable } from '@nestjs/common'

import type { Usuario } from '../../domain/entities/usuario.entity'
import type { CambiosUsuario, FiltroUsuarios, NuevoUsuario, PaginaUsuarios, UsuarioRepository } from '../../domain/repositories/usuario.repository'
import type { Rol } from '../../domain/entities/usuario.entity'
import type { Usuario as FilaUsuario } from '../persistence/generated/prisma/client'
import { PrismaService } from '../persistence/prisma.service'

const aDominio = (f: FilaUsuario): Usuario => ({
  id: f.id,
  email: f.email,
  nombre: f.nombre,
  rol: f.rol,
  activo: f.activo,
  creado_en: f.creado_en.toISOString(),
  telefono: f.telefono ?? null,
})

@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** En una transacción: un nadador nace con su perfil de nadador (sin entrenador), así un entrenador puede elegirlo. */
  crear(datos: NuevoUsuario): Promise<Usuario> {
    return this.prisma.$transaction(async (tx) => {
      const fila = await tx.usuario.create({
        data: { email: datos.email, nombre: datos.nombre, rol: datos.rol, password_hash: datos.passwordHash, telefono: datos.telefono ?? null },
      })
      if (datos.rol === 'nadador') await tx.nadador.create({ data: { usuario_id: fila.id, nombre: fila.nombre } })
      return aDominio(fila)
    })
  }

  async obtener(id: string): Promise<Usuario | null> {
    const fila = await this.prisma.usuario.findUnique({ where: { id } })
    return fila ? aDominio(fila) : null
  }

  async buscarParaIngresar(email: string): Promise<(Usuario & { passwordHash: string }) | null> {
    const fila = await this.prisma.usuario.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    return fila ? { ...aDominio(fila), passwordHash: fila.password_hash } : null
  }

  async existeEmail(email: string): Promise<boolean> {
    return (await this.prisma.usuario.count({ where: { email: { equals: email, mode: 'insensitive' } } })) > 0
  }

  async hayAdministrador(): Promise<boolean> {
    return (await this.prisma.usuario.count({ where: { rol: 'administrador' } })) > 0
  }

  /**
   * En una transacción: el nombre del perfil de nadador acompaña al de la cuenta (es el que ve el entrenador), y una
   * cuenta que pasa a ser de nadador recibe su perfil.
   */
  actualizar(id: string, cambios: CambiosUsuario): Promise<Usuario | null> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.usuario.updateManyAndReturn({
        where: { id },
        data: { nombre: cambios.nombre, telefono: cambios.telefono, rol: cambios.rol, activo: cambios.activo },
      })
      if (!r[0]) return null
      if (cambios.nombre !== undefined) await tx.nadador.updateMany({ where: { usuario_id: id }, data: { nombre: cambios.nombre } })
      if (r[0].rol === 'nadador') {
        await tx.nadador.upsert({ where: { usuario_id: id }, create: { usuario_id: id, nombre: r[0].nombre }, update: {} })
      }
      return aDominio(r[0])
    })
  }

  async listar(filtro: FiltroUsuarios): Promise<PaginaUsuarios> {
    const texto = filtro.texto?.trim()
    const where = {
      rol: filtro.rol,
      activo: filtro.activo,
      ...(texto
        ? { OR: [{ email: { contains: texto, mode: 'insensitive' as const } }, { nombre: { contains: texto, mode: 'insensitive' as const } }] }
        : {}),
    }
    const porPagina = filtro.porPagina ?? 10
    const pagina = Math.max(1, filtro.pagina ?? 1)
    const [filas, total] = await Promise.all([
      this.prisma.usuario.findMany({ where, orderBy: [{ nombre: 'asc' }, { id: 'asc' }], skip: (pagina - 1) * porPagina, take: porPagina }),
      this.prisma.usuario.count({ where }),
    ])
    return { usuarios: filas.map(aDominio), total, pagina, por_pagina: porPagina }
  }

  async contarPorRol(): Promise<Record<Rol, number>> {
    const grupos = await this.prisma.usuario.groupBy({ by: ['rol'], where: { activo: true }, _count: { _all: true } })
    const r: Record<Rol, number> = { administrador: 0, entrenador: 0, nadador: 0 }
    for (const g of grupos) r[g.rol] = g._count._all
    return r
  }

  async obtenerHash(id: string): Promise<string | null> {
    return (await this.prisma.usuario.findUnique({ where: { id }, select: { password_hash: true } }))?.password_hash ?? null
  }

  async cambiarHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.usuario.update({ where: { id }, data: { password_hash: passwordHash } })
  }
}
