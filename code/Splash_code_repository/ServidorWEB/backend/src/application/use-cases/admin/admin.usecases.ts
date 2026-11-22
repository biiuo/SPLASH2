import type { EstadoSesion, ResumenSesion, Sesion } from '../../../domain/entities/sesion.entity'
import { type Identidad, type Rol, type Usuario } from '../../../domain/entities/usuario.entity'
import type { Latido, LatidoRepository } from '../../../domain/repositories/latido.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import type { CambiosUsuario, PaginaUsuarios, UsuarioRepository } from '../../../domain/repositories/usuario.repository'
import type { Grupo } from '../../../domain/entities/nadador.entity'
import { GrupoRepetido, type GrupoRepository } from '../../../domain/repositories/nadador.repository'
import { esUuid } from '../../../domain/services/identificador'
import type { CifradorContrasenas } from '../../ports/autenticacion.ports'
import { ConflictoException, NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'
import { normalizarEmail, problemasDeCuenta, telefonoDe } from '../auth/validar-cuenta'

const ROLES: Rol[] = ['administrador', 'entrenador', 'nadador']
/** Sin latido en este tiempo, el componente se considera caído (el servidor de IA late cada 5 s). */
export const LATIDO_VIVO_S = 15
/** Sesiones recientes que se miran para el resumen (las cuentas totales salen de la base, sin límite). */
const RECIENTES = 500
const DIA = 24 * 60 * 60 * 1000

/**
 * Una sesión con "errores de detección": terminó sin ningún tramo medido, o más de la mitad de sus tramos son
 * estimados (la cámara no veía a los nadadores la mayor parte del tiempo).
 */
export function conErroresDeDeteccion(s: ResumenSesion): boolean {
  if (s.estado !== 'finalizada') return false
  const tramos = s.por_carril.reduce((a, c) => a + c.tramos, 0)
  const estimados = s.por_carril.reduce((a, c) => a + c.tramos_estimados, 0)
  return tramos === 0 || estimados / tramos > 0.5
}

export type ResumenAdmin = {
  usuarios: Record<Rol, number>
  /** Entrenadores que esperan aprobación. */
  pendientes: number
  sesiones: Record<EstadoSesion, number> & { total: number; con_errores: number }
  /** Sesiones por día de los últimos 30 días (de las recientes). */
  por_dia: { dia: string; sesiones: number }[]
  recientes: ResumenSesion[]
  rendimiento: { distancia_m: number; velocidad_media_ms: number | null; largos: number; tramos: number; tramos_estimados: number }
}

export type EstadoComponente = Latido & { vivo: boolean; hace_s: number }

/** Lo que solo hace el administrador: ver todo el sistema y manejar las cuentas. */
export class AdminUseCases {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly sesiones: SesionRepository,
    private readonly latidos: LatidoRepository,
    private readonly cifrador: CifradorContrasenas,
    private readonly grupos: GrupoRepository,
  ) {}

  async resumen(): Promise<ResumenAdmin> {
    const [usuarios, pendientes, estados, recientes] = await Promise.all([
      this.usuarios.contarPorRol(),
      this.usuarios.contarPendientes(),
      this.sesiones.contarPorEstado(),
      this.sesiones.listarRecientes(RECIENTES, null),
    ])
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const por_dia = Array.from({ length: 30 }, (_, i) => {
      const desde = hoy.getTime() - (29 - i) * DIA
      return {
        dia: new Date(desde).toISOString().slice(0, 10),
        sesiones: recientes.filter((s) => Date.parse(s.inicio) >= desde && Date.parse(s.inicio) < desde + DIA).length,
      }
    })
    const carriles = recientes.flatMap((s) => s.por_carril)
    const metros = carriles.reduce((a, c) => a + c.distancia_m, 0)
    const segundos = carriles.reduce((a, c) => a + (c.velocidad_media_ms ? c.distancia_m / c.velocidad_media_ms : 0), 0)
    return {
      usuarios,
      pendientes,
      sesiones: {
        ...estados,
        total: estados.activa + estados.finalizada + estados.cancelada,
        con_errores: recientes.filter(conErroresDeDeteccion).length,
      },
      por_dia,
      recientes: recientes.slice(0, 8),
      rendimiento: {
        distancia_m: Math.round(metros),
        velocidad_media_ms: segundos > 0 ? Math.round((metros / segundos) * 1000) / 1000 : null,
        largos: carriles.reduce((a, c) => a + c.largos, 0),
        tramos: carriles.reduce((a, c) => a + c.tramos, 0),
        tramos_estimados: carriles.reduce((a, c) => a + c.tramos_estimados, 0),
      },
    }
  }

  /**
   * Buscar cuentas por correo o nombre, rol y estado, de a una página (10 por defecto, hasta 50).
   * Los entrenadores que esperan aprobación solo aparecen con `pendiente=true`.
   */
  listarUsuarios(q: { texto?: unknown; rol?: unknown; activo?: unknown; pendiente?: unknown; pagina?: unknown; por_pagina?: unknown }): Promise<PaginaUsuarios> {
    const rol = typeof q.rol === 'string' && ROLES.includes(q.rol as Rol) ? (q.rol as Rol) : undefined
    const activo = q.activo === 'true' ? true : q.activo === 'false' ? false : undefined
    const pendiente = q.pendiente === 'true'
    const pagina = Math.max(1, Math.floor(Number(q.pagina) || 1))
    const porPagina = Math.min(50, Math.max(1, Math.floor(Number(q.por_pagina) || 10)))
    return this.usuarios.listar({ texto: typeof q.texto === 'string' ? q.texto : undefined, rol, activo, pendiente, pagina, porPagina })
  }

  /** Aceptar a un entrenador que se registró: desde ahora puede iniciar sesión. */
  async aprobarEntrenador(id: string): Promise<Usuario> {
    const u = esUuid(id) ? await this.usuarios.aprobar(id) : null
    if (!u) throw new NoEncontradoException('No hay una solicitud pendiente con ese id.')
    return u
  }

  /** Rechazar a un entrenador que se registró: la cuenta se borra (no tenía datos) y el correo queda libre. */
  async rechazarEntrenador(id: string): Promise<{ ok: true }> {
    if (!esUuid(id) || !(await this.usuarios.borrarPendiente(id))) throw new NoEncontradoException('No hay una solicitud pendiente con ese id.')
    return { ok: true }
  }

  /** Un entrenador (o administrador) activo al que se le puede dar un grupo. */
  private async entrenadorValido(id: unknown): Promise<string> {
    const u = typeof id === 'string' && esUuid(id) ? await this.usuarios.obtener(id) : null
    if (!u || (u.rol !== 'entrenador' && u.rol !== 'administrador')) throw new ValidacionException('Elegí un entrenador.')
    if (!u.activo) throw new ValidacionException(`La cuenta de ${u.nombre} está desactivada.`)
    if (u.pendiente) throw new ValidacionException(`${u.nombre} todavía no fue aprobado como entrenador.`)
    return u.id
  }

  /** Crear un grupo a nombre de un entrenador (si no, el grupo queda del administrador que lo crea). */
  async crearGrupoPara(entrenadorId: unknown, nombre: unknown): Promise<Grupo> {
    const id = await this.entrenadorValido(entrenadorId)
    const n = typeof nombre === 'string' ? nombre.trim() : ''
    if (!n || n.length > 60) throw new ValidacionException('El grupo necesita un nombre de hasta 60 caracteres.')
    try {
      return await this.grupos.crear(id, n)
    } catch (e) {
      if (e instanceof GrupoRepetido) throw new ConflictoException(`Ese entrenador ya tiene un grupo llamado "${n}".`)
      throw e
    }
  }

  /** Pasar un grupo (con sus nadadores) a otro entrenador. */
  async asignarGrupo(grupoId: string, entrenadorId: unknown): Promise<Grupo> {
    const g = esUuid(grupoId) ? await this.grupos.obtener(grupoId) : null
    if (!g) throw new NoEncontradoException('No existe ese grupo.')
    const id = await this.entrenadorValido(entrenadorId)
    try {
      return await this.grupos.cambiarEntrenador(g.id, id)
    } catch (e) {
      if (e instanceof GrupoRepetido) throw new ConflictoException(`Ese entrenador ya tiene un grupo llamado "${g.nombre}": renombralo antes.`)
      throw e
    }
  }

  /** Crear una cuenta de cualquier rol (el administrador es el único que puede crear otros administradores). */
  async crearUsuario(datos: { email?: unknown; nombre?: unknown; contrasena?: unknown; rol?: unknown; telefono?: unknown }): Promise<Usuario> {
    const errores = problemasDeCuenta(datos ?? {})
    if (!ROLES.includes(datos?.rol as Rol)) errores.push(`El rol tiene que ser ${ROLES.join(', ')}.`)
    let telefono: string | null | undefined
    try {
      telefono = telefonoDe(datos?.telefono)
    } catch (e) {
      errores.push((e as Error).message)
    }
    if (errores.length) throw new ValidacionException('Los datos de la cuenta no son válidos.', errores)
    const email = normalizarEmail(datos.email)
    if (await this.usuarios.existeEmail(email)) throw new ConflictoException('Ya hay una cuenta con ese correo.')
    return this.usuarios.crear({
      email,
      nombre: (datos.nombre as string).trim(),
      rol: datos.rol as Rol,
      passwordHash: await this.cifrador.cifrar(datos.contrasena as string),
      telefono: telefono ?? null,
    })
  }

  /** Cambiar nombre, teléfono, rol o estado. Un administrador no puede quitarse a sí mismo el rol ni desactivarse. */
  async actualizarUsuario(admin: Identidad, id: string, datos: { nombre?: unknown; telefono?: unknown; rol?: unknown; activo?: unknown }): Promise<Usuario> {
    if (!esUuid(id)) throw new NoEncontradoException('No existe ese usuario.')
    const cambios: CambiosUsuario = {}
    if (datos?.nombre !== undefined) {
      const n = typeof datos.nombre === 'string' ? datos.nombre.trim() : ''
      if (n.length < 1 || n.length > 80) throw new ValidacionException('El nombre tiene que tener de 1 a 80 letras.')
      cambios.nombre = n
    }
    try {
      cambios.telefono = telefonoDe(datos?.telefono)
    } catch (e) {
      throw new ValidacionException((e as Error).message)
    }
    if (datos?.rol !== undefined) {
      if (!ROLES.includes(datos.rol as Rol)) throw new ValidacionException(`El rol tiene que ser ${ROLES.join(', ')}.`)
      cambios.rol = datos.rol as Rol
    }
    if (datos?.activo !== undefined) {
      if (typeof datos.activo !== 'boolean') throw new ValidacionException('activo tiene que ser true o false.')
      cambios.activo = datos.activo
    }
    if (id === admin.id && ((cambios.rol && cambios.rol !== 'administrador') || cambios.activo === false)) {
      throw new ValidacionException('No podés quitarte el rol de administrador ni desactivar tu propia cuenta.')
    }
    const u = await this.usuarios.actualizar(id, cambios)
    if (!u) throw new NoEncontradoException('No existe ese usuario.')
    return u
  }

  /** Poner una contraseña nueva (por ejemplo, si alguien la olvidó). Se la comunica el administrador. */
  async restablecerContrasena(id: string, nueva: unknown): Promise<{ ok: true }> {
    if (!esUuid(id) || !(await this.usuarios.obtenerHash(id))) throw new NoEncontradoException('No existe ese usuario.')
    const errores = problemasDeCuenta({ email: 'x@x.xx', nombre: 'x', contrasena: nueva })
    if (errores.length) throw new ValidacionException('La contraseña nueva no es válida.', errores)
    await this.usuarios.cambiarHash(id, await this.cifrador.cifrar(nueva as string))
    return { ok: true }
  }

  /** Para el monitoreo: cada componente con si está vivo, y las sesiones en curso. */
  async monitoreo(): Promise<{ componentes: EstadoComponente[]; activas: Sesion[] }> {
    const [latidos, activas] = await Promise.all([this.latidos.listar(), this.sesiones.obtenerActivas()])
    const ahora = Date.now()
    return {
      componentes: latidos.map((l) => {
        const hace_s = Math.max(0, Math.round((ahora - Date.parse(l.ultimo_latido)) / 1000))
        return { ...l, hace_s, vivo: hace_s <= LATIDO_VIVO_S }
      }),
      activas,
    }
  }

  /** Lo que manda el servidor de IA (o un celular) cada pocos segundos. */
  async registrarLatido(componente: unknown, estado: unknown): Promise<{ ok: true }> {
    if (typeof componente !== 'string' || !/^[a-z0-9:_-]{1,64}$/i.test(componente)) throw new ValidacionException('componente no es válido.')
    const e = estado && typeof estado === 'object' && !Array.isArray(estado) ? (estado as Record<string, unknown>) : {}
    if (JSON.stringify(e).length > 4000) throw new ValidacionException('El estado es demasiado grande.')
    await this.latidos.registrar(componente, e)
    return { ok: true }
  }
}
