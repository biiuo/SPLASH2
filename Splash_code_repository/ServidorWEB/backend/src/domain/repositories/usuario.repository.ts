import type { Rol, Usuario } from '../entities/usuario.entity'

export type NuevoUsuario = { email: string; nombre: string; rol: Rol; passwordHash: string }

export interface UsuarioRepository {
  /** Crea el usuario. Si es nadador, crea también su perfil de nadador (sin entrenador). Lanza si el correo ya existe. */
  crear(datos: NuevoUsuario): Promise<Usuario>
  obtener(id: string): Promise<Usuario | null>
  /** Para iniciar sesión: el usuario con su contraseña cifrada. El correo se compara sin mayúsculas. */
  buscarParaIngresar(email: string): Promise<(Usuario & { passwordHash: string }) | null>
  existeEmail(email: string): Promise<boolean>
  hayAdministrador(): Promise<boolean>
}

export const USUARIO_REPOSITORY = Symbol('UsuarioRepository')
