import { Injectable } from '@nestjs/common'

import type { Usuario } from '../../domain/entities/usuario.entity'
import type { NuevoUsuario, UsuarioRepository } from '../../domain/repositories/usuario.repository'
import type { Usuario as FilaUsuario } from '../persistence/generated/prisma/client'
import { PrismaService } from '../persistence/prisma.service'

const aDominio = (f: FilaUsuario): Usuario => ({ id: f.id, email: f.email, nombre: f.nombre, rol: f.rol, activo: f.activo })

@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** En una transacción: un nadador nace con su perfil de nadador (sin entrenador), así un entrenador puede elegirlo. */
  crear(datos: NuevoUsuario): Promise<Usuario> {
    return this.prisma.$transaction(async (tx) => {
      const fila = await tx.usuario.create({
        data: { email: datos.email, nombre: datos.nombre, rol: datos.rol, password_hash: datos.passwordHash },
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
}
