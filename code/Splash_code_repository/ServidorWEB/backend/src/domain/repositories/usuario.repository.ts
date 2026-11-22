import type { Rol, Usuario } from '../entities/usuario.entity'

export type NuevoUsuario = { email: string; nombre: string; rol: Rol; passwordHash: string; telefono?: string | null; pendiente?: boolean }

/**
 * Filtro del listado del administrador: texto (correo o nombre), rol y estado. `pendiente: true` lista solo los
 * entrenadores que esperan aprobación; sin indicarlo, esos no aparecen.
 */
export type FiltroUsuarios = { texto?: string; rol?: Rol; activo?: boolean; pendiente?: boolean; pagina?: number; porPagina?: number }

/** Una página de resultados y cuántos hay en total. */
export type PaginaUsuarios = { usuarios: Usuario[]; total: number; pagina: number; por_pagina: number }

/** Lo que el administrador puede cambiar de una cuenta (undefined = no tocar). */
export type CambiosUsuario = { nombre?: string; telefono?: string | null; rol?: Rol; activo?: boolean }

export interface UsuarioRepository {
  /** Crea el usuario. Si es nadador, crea también su perfil de nadador (sin entrenador). Lanza si el correo ya existe. */
  crear(datos: NuevoUsuario): Promise<Usuario>
  obtener(id: string): Promise<Usuario | null>
  /** Para iniciar sesión: el usuario con su contraseña cifrada. El correo se compara sin mayúsculas. */
  buscarParaIngresar(email: string): Promise<(Usuario & { passwordHash: string }) | null>
  existeEmail(email: string): Promise<boolean>
  hayAdministrador(): Promise<boolean>
  /** Cambia nombre, teléfono, rol o estado (y el nombre del perfil de nadador, si tiene). null si no existe. */
  actualizar(id: string, cambios: CambiosUsuario): Promise<Usuario | null>
  /** Una página de las cuentas que cumplen el filtro, por nombre, y el total. */
  listar(filtro: FiltroUsuarios): Promise<PaginaUsuarios>
  /** Cuántas cuentas activas (y aprobadas) hay de cada rol. */
  contarPorRol(): Promise<Record<Rol, number>>
  /** Cuántos entrenadores esperan la aprobación del administrador. */
  contarPendientes(): Promise<number>
  /** Aprueba una cuenta pendiente. null si no existe o no estaba pendiente. */
  aprobar(id: string): Promise<Usuario | null>
  /** Borra una cuenta SOLO si está pendiente (rechazo). false si no existe o no estaba pendiente. */
  borrarPendiente(id: string): Promise<boolean>
  /** La contraseña cifrada, para comprobar la actual antes de cambiarla. null si no existe. */
  obtenerHash(id: string): Promise<string | null>
  cambiarHash(id: string, passwordHash: string): Promise<void>
}

export const USUARIO_REPOSITORY = Symbol('UsuarioRepository')
