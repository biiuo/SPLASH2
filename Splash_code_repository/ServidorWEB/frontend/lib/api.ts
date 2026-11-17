// El cliente de la API del backend. Todas las llamadas van a /api/..., que la web reenvía al backend
// (ver app/api/[...ruta]/route.ts), así el navegador no necesita saber dónde está el backend.
import type {
  AnalisisConfiguracion,
  ArchivoCalibracion,
  CalibracionGuardada,
  CalibracionResumen,
  Configuracion,
  ConfiguracionEfectiva,
  EstadoCarriles,
  Llegada,
  Marca,
  MarcaCuerda,
  ModoProceso,
  Grupo,
  NadadorDeLaLista,
  PuntosReferencia,
  ResultadoEvaluacion,
  ResultadosSesion,
  Sesion,
  ResumenSesion,
  Usuario,
  Monitoreo,
  ResumenAdmin,
  Rol,
  EstadoComponente,
  Objetivo,
  TipoObjetivo,
  Nadador,
} from './tipos'
import type { ArchivoZonas, Zona } from './zonas'

export class ErrorApi extends Error {
  estado: number
  detalles: string[]
  constructor(estado: number, mensaje: string, detalles: string[] = []) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
    this.detalles = detalles
  }
}

function mensajeDe(estado: number, datos: { error?: string } | null): string {
  if (estado === 503) return 'El servidor no tiene acceso a la base de datos.'
  if (estado === 403 && !datos?.error) return 'Tu rol no permite hacer esto.'
  if (estado === 502) return 'No se pudo conectar con el servidor.'
  return datos?.error ?? `El servidor respondió ${estado}.`
}

async function pedir<T>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/api/${ruta}`, {
      method: metodo,
      cache: 'no-store',
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor.')
  }
  const datos = (await r.json().catch(() => null)) as (T & { error?: string; errores?: string[] }) | null
  if (r.status === 401 && !ruta.startsWith('auth/')) avisarSinSesion()
  if (!r.ok) throw new ErrorApi(r.status, mensajeDe(r.status, datos), datos?.errores)
  return datos as T
}

/** Se dispara cuando el backend dice que no hay sesión (venció): la pantalla de la cuenta lo escucha. */
export const EVENTO_SIN_SESION = 'safesplash:sin-sesion'
function avisarSinSesion() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_SIN_SESION))
}

export const api = {
  // ---- cuenta (el token lo guarda la web en una cookie que el navegador no puede leer) ----
  registrarse: (d: { email: string; nombre: string; contrasena: string; rol: 'nadador' | 'entrenador'; telefono?: string | null }) =>
    pedir<{ usuario: Usuario }>('auth/registro', 'POST', d),
  ingresar: (d: { email: string; contrasena: string }) => pedir<{ usuario: Usuario }>('auth/ingresar', 'POST', d),
  yo: () => pedir<Usuario>('auth/yo'),
  /** Cambia el nombre propio (el token nuevo lo guarda la web en la cookie). */
  actualizarPerfil: (d: { nombre?: string; telefono?: string | null }) => pedir<{ usuario: Usuario }>('auth/yo', 'PATCH', d),
  cambiarContrasena: (d: { actual: string; nueva: string }) => pedir<{ ok: true }>('auth/yo/contrasena', 'POST', d),
  salir: () => fetch('/api/auth/salir', { method: 'POST' }).then(() => undefined),

  configuracion: () => pedir<ConfiguracionEfectiva>('configuracion'),
  guardarConfiguracion: (c: Configuracion) => pedir<Configuracion>('configuracion', 'PUT', c),
  analizarConfiguracion: (c: Configuracion) => pedir<AnalisisConfiguracion>('configuracion/analisis', 'POST', c),

  puntosReferencia: () => pedir<PuntosReferencia>('calibracion/puntos-referencia'),
  evaluarCalibracion: (e: { marcas: Marca[]; omitidos: string[]; cuerdas?: MarcaCuerda[]; image_size?: [number, number] }) =>
    pedir<ResultadoEvaluacion>('calibracion/evaluar', 'POST', e),
  guardarCalibracion: (e: {
    image_size: [number, number]
    marcas: Marca[]
    omitidos: string[]
    cuerdas?: MarcaCuerda[]
    nombre?: string | null
    llegada?: Llegada | null
    /** La imagen sobre la que se marcó: "data:image/jpeg;base64,...". */
    imagen?: string | null
  }) =>
    pedir<CalibracionGuardada>('calibracion', 'POST', e),
  calibracionActiva: () =>
    pedir<(ArchivoCalibracion & { id: string; nombre: string | null; zonas: Zona[] | null; llegada: Llegada | null }) | null>('calibracion'),
  historialCalibraciones: () => pedir<CalibracionResumen[]>('calibracion/historial'),
  activarCalibracion: (id: string) => pedir<{ id: string }>(`calibracion/${encodeURIComponent(id)}/activar`, 'POST'),
  /** Ninguna calibración queda activa. */
  desactivarCalibracion: () => pedir<{ id: null }>('calibracion/desactivar', 'POST'),
  /** Borra una calibración del historial (no la activa ni una en uso). */
  eliminarCalibracion: (id: string) => pedir<{ id: string }>(`calibracion/${encodeURIComponent(id)}`, 'DELETE'),
  /** Cambia el nombre, las zonas y/o la imagen (lo que no venga queda igual; null lo borra). */
  actualizarCalibracion: (id: string, cambios: { nombre?: string | null; zonas?: Zona[] | null; imagen?: string | null }) =>
    pedir<CalibracionGuardada>(`calibracion/${encodeURIComponent(id)}`, 'PATCH', cambios),
  /** La imagen sobre la que se calibró, lista para dibujar en un canvas. null si esa calibración no tiene. */
  imagenDeCalibracion: async (id: string): Promise<HTMLCanvasElement | null> => {
    const r = await fetch(`/api/calibracion/${encodeURIComponent(id)}/imagen`)
    if (r.status === 404) return null
    if (!r.ok) throw new ErrorApi(r.status, 'No se pudo cargar la imagen de la calibración.')
    const bmp = await createImageBitmap(await r.blob())
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    c.getContext('2d')?.drawImage(bmp, 0, 0)
    bmp.close()
    return c
  },
  /**
   * El último frame de la cámara (lo deja el servidor de IA), listo para dibujar en un canvas.
   * Lanza ErrorApi con el motivo si todavía no llegó ninguno o si dejaron de llegar.
   */
  frameDeCamara: async (): Promise<HTMLCanvasElement> => {
    let r: Response
    try {
      r = await fetch('/api/calibracion/frame-actual', { cache: 'no-store' })
    } catch {
      throw new ErrorApi(0, 'No se pudo conectar con el servidor.')
    }
    if (!r.ok) {
      const datos = (await r.json().catch(() => null)) as { error?: string } | null
      if (r.status === 401) avisarSinSesion()
      throw new ErrorApi(r.status, mensajeDe(r.status, datos))
    }
    const bmp = await createImageBitmap(await r.blob())
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    c.getContext('2d')?.drawImage(bmp, 0, 0)
    bmp.close()
    return c
  },
  /** Las zonas de una calibración como zones.json, o null si no tiene. */
  zonasDeCalibracion: (id: string) => pedir<ArchivoZonas | null>(`calibracion/${encodeURIComponent(id)}/zonas`),

  sesionActiva: () => pedir<Sesion | null>('sesiones/activa'),
  /** Historial: las últimas sesiones con su resumen (entrenador y administrador). */
  sesionesRecientes: (limite = 20) => pedir<ResumenSesion[]>(`sesiones?limite=${limite}`),
  /**
   * Entrenador: uno o más carriles, con un nadador o sin nadador; la sesión es de un grupo (grupoId) o libre (null).
   * Nadador: un carril (su sesión personal).
   */
  iniciarSesion: (modo: ModoProceso, carriles: { carril: number; nadador_id?: string | null }[], grupoId: string | null = null) =>
    pedir<Sesion>('sesiones', 'POST', { modo, carriles, grupo_id: grupoId }),
  /** Un nadador se suma a una sesión en curso de un entrenador (de uno de sus grupos, o libre), en ese carril. */
  unirseASesion: (id: string, carril: number) => pedir<Sesion>(`sesiones/${encodeURIComponent(id)}/unirse`, 'POST', { carril }),
  estadoCarriles: () => pedir<EstadoCarriles>('sesiones/carriles'),
  // ---- grupos (un entrenador puede tener varios) ----
  grupos: () => pedir<Grupo[]>('grupos'),
  crearGrupo: (nombre: string) => pedir<Grupo>('grupos', 'POST', { nombre }),
  renombrarGrupo: (id: string, nombre: string) => pedir<Grupo>(`grupos/${encodeURIComponent(id)}`, 'PATCH', { nombre }),
  borrarGrupo: (id: string) => pedir<null>(`grupos/${encodeURIComponent(id)}`, 'DELETE'),
  agregarAGrupo: (grupoId: string, nadadorId: string) =>
    pedir<Grupo>(`grupos/${encodeURIComponent(grupoId)}/nadadores`, 'POST', { nadador_id: nadadorId }),
  /** Sugerencias mientras se escribe (3 letras o más): hasta 8 nadadores activos. */
  sugerirNadadores: (q: string) => pedir<Nadador[]>(`grupos/buscar-nadadores?q=${encodeURIComponent(q)}`),
  /** Agrega por el correo de la cuenta (así un entrenador suma a alguien que todavía no está en sus grupos). */
  agregarAGrupoPorEmail: (grupoId: string, email: string) => pedir<Grupo>(`grupos/${encodeURIComponent(grupoId)}/nadadores`, 'POST', { email }),
  quitarDeGrupo: (grupoId: string, nadadorId: string) =>
    pedir<Grupo>(`grupos/${encodeURIComponent(grupoId)}/nadadores/${encodeURIComponent(nadadorId)}`, 'DELETE'),
  /** Todos los nadadores registrados (entrenador y administrador). */
  todosLosNadadores: () => pedir<NadadorDeLaLista[]>('grupos/nadadores'),
  /** Para un nadador: los grupos en los que está, con su entrenador. */
  misGruposComoNadador: () =>
    pedir<{ id: string; nombre: string; entrenador: string; entrenador_email?: string | null; entrenador_telefono?: string | null }[]>('grupos/mios'),
  finalizarSesion: (id: string) => pedir<Sesion>(`sesiones/${encodeURIComponent(id)}/finalizar`, 'POST'),
  resultadosSesion: (id: string) => pedir<ResultadosSesion>(`sesiones/${encodeURIComponent(id)}/resultados`),
  /** Lo que manda quien mide (aquí, el celular): posiciones en píxeles de la imagen de la calibración. */
  enviarTrayectorias: (id: string, muestras: { carril: number; identidad: number; t: number; px: [number, number]; estimada?: true }[]) =>
    pedir<{ recibidas: number; procesadas: number; descartadas: number; eventos: unknown[]; tramos: unknown[] }>(
      `sesiones/${encodeURIComponent(id)}/trayectorias`,
      'POST',
      { muestras },
    ),

  // ---- administración (solo administrador) ----
  adminResumen: () => pedir<ResumenAdmin>('admin/resumen'),
  /** Una página de cuentas (10 por defecto) y el total que cumple el filtro. */
  adminUsuarios: (f: { texto?: string; rol?: Rol | ''; activo?: '' | 'true' | 'false'; pagina?: number; porPagina?: number } = {}) => {
    const q = new URLSearchParams()
    if (f.texto) q.set('texto', f.texto)
    if (f.rol) q.set('rol', f.rol)
    if (f.activo) q.set('activo', f.activo)
    if (f.pagina) q.set('pagina', String(f.pagina))
    if (f.porPagina) q.set('por_pagina', String(f.porPagina))
    return pedir<{ usuarios: Usuario[]; total: number; pagina: number; por_pagina: number }>(`admin/usuarios${q.size ? `?${q}` : ''}`)
  },
  adminCrearGrupo: (entrenadorId: string, nombre: string) => pedir<Grupo>('admin/grupos', 'POST', { entrenador_id: entrenadorId, nombre }),
  adminAsignarGrupo: (grupoId: string, entrenadorId: string) => pedir<Grupo>(`admin/grupos/${encodeURIComponent(grupoId)}`, 'PATCH', { entrenador_id: entrenadorId }),
  adminCrearUsuario: (d: { email: string; nombre: string; contrasena: string; rol: Rol; telefono?: string | null }) => pedir<Usuario>('admin/usuarios', 'POST', d),
  adminActualizarUsuario: (id: string, d: { nombre?: string; telefono?: string | null; rol?: Rol; activo?: boolean }) =>
    pedir<Usuario>(`admin/usuarios/${encodeURIComponent(id)}`, 'PATCH', d),
  adminRestablecerContrasena: (id: string, nueva: string) => pedir<{ ok: true }>(`admin/usuarios/${encodeURIComponent(id)}/contrasena`, 'POST', { nueva }),
  adminMonitoreo: () => pedir<Monitoreo>('admin/monitoreo'),

  // ---- objetivos ----
  objetivos: () => pedir<Objetivo[]>('objetivos'),
  misObjetivos: () => pedir<Objetivo[]>('objetivos/mios'),
  crearObjetivo: (d: { nadador_id: string; tipo: TipoObjetivo; meta: number; desde: string; hasta: string; descripcion?: string | null }) =>
    pedir<Objetivo>('objetivos', 'POST', d),
  actualizarObjetivo: (id: string, d: Partial<{ tipo: TipoObjetivo; meta: number; desde: string; hasta: string; descripcion: string | null }>) =>
    pedir<Objetivo>(`objetivos/${encodeURIComponent(id)}`, 'PATCH', d),
  borrarObjetivo: (id: string) => pedir<null>(`objetivos/${encodeURIComponent(id)}`, 'DELETE'),
  /** Servidor de IA y cámara (para el monitoreo del entrenador). */
  estadoComponentes: () => pedir<EstadoComponente[]>('latidos'),
}
