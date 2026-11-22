import { ROL_REGISTRO_PUBLICO, ROLES_REGISTRABLES, type Rol, type Usuario } from '../../../domain/entities/usuario.entity'
import type { UsuarioRepository } from '../../../domain/repositories/usuario.repository'
import type { CifradorContrasenas, EmisorTokens } from '../../ports/autenticacion.ports'
import {
  ConflictoException,
  NoAutenticadoException,
  NoEncontradoException,
  ValidacionException,
} from '../../exceptions/aplicacion.exceptions'
import { normalizarEmail, problemasDeCuenta, telefonoDe } from './validar-cuenta'

export type RegistroEntrada = { email: string; nombre: string; contrasena: string; rol?: Rol; telefono?: string | null }
export type IngresoEntrada = { email: string; contrasena: string }
export type SesionUsuario = { token: string; usuario: Usuario }
/** Un entrenador recién registrado: no recibe token hasta que el administrador lo apruebe. */
export type RegistroPendiente = { pendiente: true; usuario: Usuario }

/** Lo que ve quien intenta entrar con una cuenta de entrenador sin aprobar. */
export const MENSAJE_PENDIENTE = 'Tu cuenta de entrenador está esperando la aprobación del administrador. Podrás ingresar cuando la acepte.'

/**
 * Una cuenta nueva de nadador o entrenador. El nadador queda con la sesión iniciada; el entrenador queda pendiente
 * hasta que un administrador lo apruebe (sin token).
 */
export class RegistrarseUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrador: CifradorContrasenas,
    private readonly tokens: EmisorTokens,
  ) {}

  async execute(entrada: RegistroEntrada): Promise<SesionUsuario | RegistroPendiente> {
    const errores = problemasDeCuenta(entrada ?? {})
    const rol = entrada?.rol ?? ROL_REGISTRO_PUBLICO
    if (!ROLES_REGISTRABLES.includes(rol)) errores.push(`El rol tiene que ser ${ROLES_REGISTRABLES.join(' o ')}.`)
    let telefono: string | null | undefined
    try {
      telefono = telefonoDe(entrada?.telefono)
    } catch (e) {
      errores.push((e as Error).message)
    }
    if (errores.length > 0) throw new ValidacionException('Los datos de la cuenta no son válidos.', errores)

    const email = normalizarEmail(entrada.email)
    if (await this.usuarios.existeEmail(email)) throw new ConflictoException('Ya hay una cuenta con ese correo.')

    const usuario = await this.usuarios.crear({
      email,
      nombre: entrada.nombre.trim(),
      rol,
      passwordHash: await this.cifrador.cifrar(entrada.contrasena),
      telefono: telefono ?? null,
      pendiente: rol === 'entrenador',
    })
    if (usuario.pendiente) return { pendiente: true, usuario }
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
    if (encontrado.pendiente) throw new NoAutenticadoException(MENSAJE_PENDIENTE)
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
 * Cambiar los datos propios permitidos: el nombre y el teléfono. El correo, el rol y el estado de la cuenta no se
 * tocan desde acá. Devuelve un token nuevo: el viejo lleva el nombre anterior.
 */
export class ActualizarPerfilUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly tokens: EmisorTokens,
  ) {}

  async execute(id: string, entrada: { nombre?: unknown; telefono?: unknown }): Promise<SesionUsuario> {
    let nombre: string | undefined
    if (entrada?.nombre !== undefined) {
      nombre = typeof entrada.nombre === 'string' ? entrada.nombre.trim() : ''
      if (nombre.length < 1 || nombre.length > 80) throw new ValidacionException('El nombre tiene que tener de 1 a 80 letras.')
    }
    let telefono: string | null | undefined
    try {
      telefono = telefonoDe(entrada?.telefono)
    } catch (e) {
      throw new ValidacionException((e as Error).message)
    }
    if (nombre === undefined && telefono === undefined) throw new ValidacionException('No hay nada que cambiar.')
    const usuario = await this.usuarios.actualizar(id, { nombre, telefono })
    if (!usuario) throw new NoEncontradoException('No existe ese usuario.')
    return { token: await this.tokens.emitir({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }), usuario }
  }
}

/** Cambiar la contraseña propia: hay que dar la actual (si alguien encuentra la sesión abierta, no puede cambiarla). */
export class CambiarContrasenaUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrador: CifradorContrasenas,
  ) {}

  async execute(id: string, entrada: { actual?: unknown; nueva?: unknown }): Promise<{ ok: true }> {
    const actual = typeof entrada?.actual === 'string' ? entrada.actual : ''
    const hash = await this.usuarios.obtenerHash(id)
    if (!hash) throw new NoEncontradoException('No existe ese usuario.')
    if (!actual || !(await this.cifrador.coincide(actual, hash))) throw new ValidacionException('La contraseña actual no es correcta.')
    // mismas reglas que al crear la cuenta (largo mínimo y máximo)
    const errores = problemasDeCuenta({ email: 'x@x.xx', nombre: 'x', contrasena: entrada?.nueva })
    if (errores.length) throw new ValidacionException('La contraseña nueva no es válida.', errores)
    if (entrada.nueva === actual) throw new ValidacionException('La contraseña nueva tiene que ser distinta de la actual.')
    await this.usuarios.cambiarHash(id, await this.cifrador.cifrar(entrada.nueva as string))
    return { ok: true }
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
