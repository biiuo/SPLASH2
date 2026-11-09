import { Injectable } from '@nestjs/common'

import type { Grupo, Nadador } from '../../domain/entities/nadador.entity'
import type { Rol } from '../../domain/entities/usuario.entity'
import { GrupoRepetido, type GrupoRepository, type NadadorRepository } from '../../domain/repositories/nadador.repository'
import { PrismaService } from '../persistence/prisma.service'

const CON_CUENTA = { usuario: { select: { email: true } } } as const

type FilaNadador = { id: string; usuario_id: string | null; nombre: string; usuario: { email: string } | null }
const aNadador = (f: FilaNadador): Nadador => ({ id: f.id, usuario_id: f.usuario_id, nombre: f.nombre, email: f.usuario?.email ?? null })

@Injectable()
export class PrismaNadadorRepository implements NadadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(id: string): Promise<Nadador | null> {
    const f = await this.prisma.nadador.findUnique({ where: { id }, include: CON_CUENTA })
    return f ? aNadador(f) : null
  }

  async deUsuario(usuarioId: string): Promise<Nadador | null> {
    const f = await this.prisma.nadador.findUnique({ where: { usuario_id: usuarioId }, include: CON_CUENTA })
    return f ? aNadador(f) : null
  }

  async asegurarDeUsuario(usuarioId: string, nombre: string): Promise<Nadador> {
    const f = await this.prisma.nadador.upsert({
      where: { usuario_id: usuarioId },
      create: { usuario_id: usuarioId, nombre },
      update: {},
      include: CON_CUENTA,
    })
    return aNadador(f)
  }

  async todos(): Promise<Nadador[]> {
    const filas = await this.prisma.nadador.findMany({
      where: { usuario: { activo: true, rol: 'nadador' } },
      orderBy: { nombre: 'asc' },
      include: CON_CUENTA,
    })
    return filas.map(aNadador)
  }

  async buscarPorEmail(email: string): Promise<{ usuario: { id: string; nombre: string; rol: Rol }; nadador: Nadador | null } | null> {
    const u = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, nombre: true, rol: true, perfil_nadador: { include: CON_CUENTA } },
    })
    if (!u) return null
    return { usuario: { id: u.id, nombre: u.nombre, rol: u.rol }, nadador: u.perfil_nadador ? aNadador(u.perfil_nadador) : null }
  }
}

const CON_TODO = {
  entrenador: { select: { nombre: true } },
  nadadores: { include: { nadador: { include: CON_CUENTA } } },
} as const

type FilaGrupo = {
  id: string
  entrenador_id: string
  nombre: string
  entrenador: { nombre: string }
  nadadores: { nadador: FilaNadador }[]
}
const aGrupo = (f: FilaGrupo): Grupo => ({
  id: f.id,
  entrenador_id: f.entrenador_id,
  entrenador: f.entrenador.nombre,
  nombre: f.nombre,
  nadadores: f.nadadores.map((n) => aNadador(n.nadador)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
})

function esRepetido(e: unknown): boolean {
  const x = e as { code?: string; message?: string }
  return x?.code === 'P2002' || /unique|duplicate key|23505/i.test(String(x?.message ?? ''))
}

@Injectable()
export class PrismaGrupoRepository implements GrupoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deEntrenador(entrenadorId: string): Promise<Grupo[]> {
    const filas = await this.prisma.grupo.findMany({ where: { entrenador_id: entrenadorId }, orderBy: { creado_en: 'asc' }, include: CON_TODO })
    return filas.map(aGrupo)
  }

  async obtener(id: string): Promise<Grupo | null> {
    const f = await this.prisma.grupo.findUnique({ where: { id }, include: CON_TODO })
    return f ? aGrupo(f) : null
  }

  async deNadador(nadadorId: string): Promise<Grupo[]> {
    const filas = await this.prisma.grupo.findMany({ where: { nadadores: { some: { nadador_id: nadadorId } } }, orderBy: { nombre: 'asc' }, include: CON_TODO })
    return filas.map(aGrupo)
  }

  async crear(entrenadorId: string, nombre: string): Promise<Grupo> {
    try {
      const f = await this.prisma.grupo.create({ data: { entrenador_id: entrenadorId, nombre }, include: CON_TODO })
      return aGrupo(f)
    } catch (e) {
      if (esRepetido(e)) throw new GrupoRepetido()
      throw e
    }
  }

  async renombrar(id: string, nombre: string): Promise<Grupo> {
    try {
      return aGrupo(await this.prisma.grupo.update({ where: { id }, data: { nombre }, include: CON_TODO }))
    } catch (e) {
      if (esRepetido(e)) throw new GrupoRepetido()
      throw e
    }
  }

  async borrar(id: string): Promise<void> {
    await this.prisma.grupo.delete({ where: { id } })
  }

  async agregarNadador(grupoId: string, nadadorId: string): Promise<void> {
    await this.prisma.grupoNadador.upsert({
      where: { grupo_id_nadador_id: { grupo_id: grupoId, nadador_id: nadadorId } },
      create: { grupo_id: grupoId, nadador_id: nadadorId },
      update: {},
    })
  }

  async quitarNadador(grupoId: string, nadadorId: string): Promise<void> {
    await this.prisma.grupoNadador.deleteMany({ where: { grupo_id: grupoId, nadador_id: nadadorId } })
  }
}
