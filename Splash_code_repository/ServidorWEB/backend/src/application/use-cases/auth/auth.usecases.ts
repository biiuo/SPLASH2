import { ROLES_REGISTRABLES, type Rol, type Usuario } from '../../../domain/entities/usuario.entity'
import type { UsuarioRepository } from '../../../domain/repositories/usuario.repository'
import type { CifradorContrasenas, EmisorTokens } from '../../ports/autenticacion.ports'
import {
  ConflictoException,
  NoAutenticadoException,
  NoEncontradoException,
  ValidacionException,
} from '../../exceptions/aplicacion.exceptions'
import { normalizarEmail, problemasDeCuenta } from './validar-cuenta'

export type RegistroEntrada = { email: string; nombre: string; contrasena: string; rol: Rol }
export type IngresoEntrada = { email: string; contrasena: string }
export type SesionUsuario = { token: string; usuario: Usuario }

/** Una cuenta nueva de nadador o entrenador. Queda con la sesión iniciada. */
export class RegistrarseUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrador: CifradorContrasenas,
    private readonly tokens: EmisorTokens,
  ) {}

  async execute(entrada: RegistroEntrada): Promise<SesionUsuario> {
    const errores = problemasDeCuenta(entrada ?? {})
    if (!ROLES_REGISTRABLES.includes(entrada?.rol)) errores.push(`El rol tiene que ser ${ROLES_REGISTRABLES.join(' o ')}.`)
    if (errores.length > 0) throw new ValidacionException('Los datos de la cuenta no son válidos.', errores)

    const email = normalizarEmail(entrada.email)
    if (await this.usuarios.existeEmail(email)) throw new ConflictoException('Ya hay una cuenta con ese correo.')

    const usuario = await this.usuarios.crear({
      email,
      nombre: entrada.nombre.trim(),
      rol: entrada.rol,
      passwordHash: await this.cifrador.cifrar(entrada.contrasena),
    })
    return { token: await this.tokens.emitir({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }), usuario }
  }
}

/** Iniciar sesión con correo y contraseña. El error no dice cuál de los dos falló (no regala qué correos existen). */
export class IngresarUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrador: CifradorContrasenas,
    private readonly tokens: EmisorTokens,
  ) {}

  async execute(entrada: IngresoEntrada): Promise<SesionUsuario> {
    const email = normalizarEmail(entrada?.email)
    const contrasena = typeof entrada?.contrasena === 'string' ? entrada.contrasena : ''
    const encontrado = email && contrasena ? await this.usuarios.buscarParaIngresar(email) : null
    const ok = encontrado ? await this.cifrador.coincide(contrasena, encontrado.passwordHash) : false
    if (!encontrado || !ok) throw new NoAutenticadoException('Correo o contraseña incorrectos.')
    if (!encontrado.activo) throw new NoAutenticadoException('La cuenta está desactivada.')

    const { passwordHash: _, ...usuario } = encontrado
    return { token: await this.tokens.emitir({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }), usuario }
  }
}

export class ObtenerPerfilUseCase {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async execute(id: string): Promise<Usuario> {
    const u = await this.usuarios.obtener(id)
    if (!u) throw new NoEncontradoException('No existe ese usuario.')
    return u
  }
}

/**
 * Al arrancar: si no hay ningún administrador y están ADMIN_EMAIL y ADMIN_PASSWORD, lo crea. Es la única forma de
 * tener el primero (nadie puede registrarse como administrador).
 */
export class CrearAdministradorInicialUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrador: CifradorContrasenas,
  ) {}

  async execute(datos: { email?: string; contrasena?: string; nombre?: string }): Promise<'creado' | 'ya_habia' | 'sin_datos'> {
    if (!datos.email || !datos.contrasena) return 'sin_datos'
    if (await this.usuarios.hayAdministrador()) return 'ya_habia'
    const nombre = datos.nombre ?? 'Administrador'
    const errores = problemasDeCuenta({ email: datos.email, nombre, contrasena: datos.contrasena })
    if (errores.length > 0) throw new ValidacionException('ADMIN_EMAIL / ADMIN_PASSWORD no son válidos.', errores)
    const email = normalizarEmail(datos.email)
    if (await this.usuarios.existeEmail(email)) throw new ConflictoException(`Ya existe una cuenta ${email} que no es administrador.`)
    await this.usuarios.crear({ email, nombre, rol: 'administrador', passwordHash: await this.cifrador.cifrar(datos.contrasena) })
    return 'creado'
  }
}
