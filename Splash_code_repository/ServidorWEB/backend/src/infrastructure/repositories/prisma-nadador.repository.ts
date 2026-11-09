import { Injectable } from '@nestjs/common'

import type { Nadador } from '../../domain/entities/nadador.entity'
import type { Rol } from '../../domain/entities/usuario.entity'
import type { NadadorRepository } from '../../domain/repositories/nadador.repository'
import { PrismaService } from '../persistence/prisma.service'

const CON_CUENTA = { usuario: { select: { email: true } } } as const

type Fila = { id: string; usuario_id: string | null; entrenador_id: string | null; nombre: string; usuario: { email: string } | null }
const aDominio = (f: Fila): Nadador => ({
  id: f.id,
  usuario_id: f.usuario_id,
  entrenador_id: f.entrenador_id,
  nombre: f.nombre,
  email: f.usuario?.email ?? null,
})

@Injectable()
export class PrismaNadadorRepository implements NadadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(id: string): Promise<Nadador | null> {
    const f = await this.prisma.nadador.findUnique({ where: { id }, include: CON_CUENTA })
    return f ? aDominio(f) : null
  }

  async deUsuario(usuarioId: string): Promise<Nadador | null> {
    const f = await this.prisma.nadador.findUnique({ where: { usuario_id: usuarioId }, include: CON_CUENTA })
    return f ? aDominio(f) : null
  }

  async asegurarDeUsuario(usuarioId: string, nombre: string): Promise<Nadador> {
    const f = await this.prisma.nadador.upsert({
      where: { usuario_id: usuarioId },
      create: { usuario_id: usuarioId, nombre },
      update: {},
      include: CON_CUENTA,
    })
    return aDominio(f)
  }

  async grupoDe(entrenadorId: string): Promise<Nadador[]> {
    const filas = await this.prisma.nadador.findMany({ where: { entrenador_id: entrenadorId }, orderBy: { nombre: 'asc' }, include: CON_CUENTA })
    return filas.map(aDominio)
  }

  async buscarPorEmail(email: string): Promise<{ usuario: { id: string; nombre: string; rol: Rol }; nadador: Nadador | null } | null> {
    const u = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, nombre: true, rol: true, perfil_nadador: { include: CON_CUENTA } },
    })
    if (!u) return null
    return { usuario: { id: u.id, nombre: u.nombre, rol: u.rol }, nadador: u.perfil_nadador ? aDominio(u.perfil_nadador) : null }
  }

  async asignarEntrenador(nadadorId: string, entrenadorId: string | null): Promise<void> {
    await this.prisma.nadador.update({ where: { id: nadadorId }, data: { entrenador_id: entrenadorId } })
  }
}
