// Métricas y formato de los resultados de un nadador. Los LARGOS los arma el backend (una sola regla para todo el
// sistema: domain/services/largos.ts); acá solo se resume, se agrupa y se da formato.
import type { EventoGuardado, Largo, ResumenSesion, TramoGuardado } from './tipos'

export type MetricasSesion = {
  largos: number
  largosEstimados: number
  distancia_m: number
  /** Suma del tiempo de los largos completos. */
  tiempoNadando_s: number
  /** Mejor y peor largo: solo entre los MEDIDOS (los estimados no cuentan para récords). */
  mejorLargo: Largo | null
  peorLargo: Largo | null
  largoPromedio_s: number | null
  velocidadMedia_ms: number | null
  /** Segundos que tarda en hacer 100 m a la velocidad media. */
  ritmo100_s: number | null
  /** Variación de los tiempos de largo (desvío / promedio): más bajo = más parejo. */
  consistencia_pct: number | null
  /** Cambio de velocidad de la segunda mitad de los largos respecto de la primera (negativo = más lento al final). */
  cambioVelocidad_pct: number | null
  tiempoDescanso_s: number
  descansos: number
}

const ms = (iso: string) => Date.parse(iso)
export const duracionTramo_s = (t: TramoGuardado) => (ms(t.t_fin) - ms(t.t_inicio)) / 1000

export function calcularMetricas(largos: Largo[], tramos: TramoGuardado[], eventos: EventoGuardado[], largo_m: number, finSesion: number): MetricasSesion {
  const n = largos.length
  const tiempo = largos.reduce((a, l) => a + l.duracion_s, 0)
  const promedio = n ? tiempo / n : null
  const vMedia = tiempo > 0 ? (n * largo_m) / tiempo : null
  const desvio = n > 1 && promedio ? Math.sqrt(largos.reduce((a, l) => a + (l.duracion_s - promedio) ** 2, 0) / (n - 1)) : null
  let cambio: number | null = null
  if (n >= 4) {
    const mitad = Math.floor(n / 2)
    const v = (ls: Largo[]) => (ls.length * largo_m) / ls.reduce((a, l) => a + l.duracion_s, 0)
    const v1 = v(largos.slice(0, mitad))
    cambio = ((v(largos.slice(n - mitad)) - v1) / v1) * 100
  }

  // descansos: de cada inicio_descanso a su fin_descanso (o al final de la sesión si sigue descansando)
  let descanso_ms = 0
  let descansos = 0
  let desde: number | null = null
  for (const e of [...eventos].sort((a, b) => ms(a.ts_captura) - ms(b.ts_captura))) {
    if (e.tipo === 'inicio_descanso' && desde === null) {
      desde = ms(e.ts_captura)
      descansos++
    } else if (e.tipo === 'fin_descanso' && desde !== null) {
      descanso_ms += ms(e.ts_captura) - desde
      desde = null
    }
  }
  if (desde !== null) descanso_ms += Math.max(0, finSesion - desde)

  const medidos = largos.filter((l) => !l.estimado).sort((a, b) => a.duracion_s - b.duracion_s)
  return {
    largos: n,
    largosEstimados: largos.filter((l) => l.estimado).length,
    distancia_m: tramos.reduce((a, t) => a + t.distancia_m, 0),
    tiempoNadando_s: tiempo,
    mejorLargo: medidos[0] ?? null,
    peorLargo: medidos[medidos.length - 1] ?? null,
    largoPromedio_s: promedio,
    velocidadMedia_ms: vMedia,
    ritmo100_s: vMedia ? 100 / vMedia : null,
    consistencia_pct: desvio !== null && promedio ? (desvio / promedio) * 100 : null,
    cambioVelocidad_pct: cambio,
    tiempoDescanso_s: descanso_ms / 1000,
    descansos,
  }
}

// ---------------------------------------------------------------- varias sesiones (historial, progreso)

/** Lo de UNA sesión que le corresponde a quien mira (el backend ya filtra los carriles que no son suyos). */
export type FilaSesion = {
  sesion: ResumenSesion
  carriles: number[]
  distancia_m: number
  velocidad_media_ms: number | null
  velocidad_max_ms: number | null
  mejor_largo_s: number | null
  largos: number
  largos_medidos: number
  duracion_s: number | null
}

export function filaDeSesion(s: ResumenSesion): FilaSesion {
  const c = s.por_carril
  const maxima = c.map((x) => x.velocidad_max_ms).filter((v): v is number => v !== null)
  const mejores = c.map((x) => x.mejor_largo_s).filter((v): v is number => v !== null)
  return {
    sesion: s,
    carriles: c.map((x) => x.carril),
    distancia_m: c.reduce((a, x) => a + x.distancia_m, 0),
    velocidad_media_ms: s.velocidad_media_ms,
    velocidad_max_ms: maxima.length ? Math.max(...maxima) : null,
    mejor_largo_s: mejores.length ? Math.min(...mejores) : null,
    largos: c.reduce((a, x) => a + x.largos, 0),
    largos_medidos: c.reduce((a, x) => a + x.largos_medidos, 0),
    duracion_s: s.fin ? (ms(s.fin) - ms(s.inicio)) / 1000 : null,
  }
}

export type Totales = {
  sesiones: number
  distancia_m: number
  /** Promedio ponderado por distancia (no el promedio de los promedios). */
  velocidad_media_ms: number | null
  /** Récord: la mejor velocidad de largo MEDIDO entre todas. */
  velocidad_max_ms: number | null
  largos: number
}

export function totales(filas: FilaSesion[]): Totales {
  const conVel = filas.filter((f) => f.velocidad_media_ms !== null && f.distancia_m > 0)
  const metros = conVel.reduce((a, f) => a + f.distancia_m, 0)
  const segundos = conVel.reduce((a, f) => a + f.distancia_m / (f.velocidad_media_ms as number), 0)
  const maxima = filas.map((f) => f.velocidad_max_ms).filter((v): v is number => v !== null)
  return {
    sesiones: filas.length,
    distancia_m: filas.reduce((a, f) => a + f.distancia_m, 0),
    velocidad_media_ms: segundos > 0 ? metros / segundos : null,
    velocidad_max_ms: maxima.length ? Math.max(...maxima) : null,
    largos: filas.reduce((a, f) => a + f.largos, 0),
  }
}

// ---------------------------------------------------------------- formato

/** 83.4 -> «1:23.4»; 23.4 -> «23.4 s» */
export function formatearSegundos(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const resto = s - m * 60
  return m > 0 ? `${m}:${resto.toFixed(1).padStart(4, '0')}` : `${resto.toFixed(1)} s`
}

export const formatearVel = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} m/s`)
export const formatearMetros = (m: number) => `${Math.round(m).toLocaleString('es-CO')} m`
export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
export const horaCorta = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const pct = (v: number | null, signo = false) => (v === null ? '—' : `${signo && v > 0 ? '+' : ''}${v.toFixed(1)} %`)
const hora = (t: number) => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const col = (s: string, n: number) => s.padEnd(n)
const der = (s: string, n: number) => s.padStart(n)

/** Todo lo de un nadador en una sesión, como texto con columnas alineadas (para el .txt). */
export function aTexto(d: {
  sesion: string
  carril: number
  nadador: string | null
  largo_m: number
  largos: Largo[]
  metricas: MetricasSesion
  tramos: TramoGuardado[]
}): string {
  const m = d.metricas
  const L: string[] = []
  L.push('SAFESPLASH - RESULTADOS DEL NADADOR')
  L.push('='.repeat(72))
  L.push(`Sesión:   ${d.sesion}`)
  L.push(`Carril:   ${d.carril}`)
  L.push(`Nadador:  ${d.nadador ?? 'sin asignar'}`)
  L.push(`Piscina:  ${d.largo_m} m`)
  L.push(`Generado: ${new Date().toLocaleString('es-CO')}`)
  L.push('')
  L.push('RESUMEN')
  L.push('-'.repeat(72))
  const fila = (k: string, v: string) => L.push(`${col(k, 42)}${v}`)
  fila('Largos completos', `${m.largos}${m.largosEstimados ? ` (${m.largosEstimados} con partes estimadas)` : ''}`)
  fila('Distancia medida (todos los tramos)', `${Math.round(m.distancia_m)} m`)
  fila('Tiempo nadando (largos completos)', formatearSegundos(m.tiempoNadando_s))
  fila('Mejor largo (solo medidos)', m.mejorLargo ? `#${m.mejorLargo.numero}  ${formatearSegundos(m.mejorLargo.duracion_s)}  (${formatearVel(m.mejorLargo.velocidad_ms)})` : '—')
  fila('Peor largo (solo medidos)', m.peorLargo ? `#${m.peorLargo.numero}  ${formatearSegundos(m.peorLargo.duracion_s)}  (${formatearVel(m.peorLargo.velocidad_ms)})` : '—')
  fila('Largo promedio', formatearSegundos(m.largoPromedio_s))
  fila('Velocidad media', formatearVel(m.velocidadMedia_ms))
  fila('Ritmo cada 100 m', formatearSegundos(m.ritmo100_s))
  fila('Consistencia (variación entre largos)', pct(m.consistencia_pct))
  fila('Cambio de velocidad 2da mitad vs 1ra', pct(m.cambioVelocidad_pct, true))
  fila('Descansos', `${m.descansos} (${formatearSegundos(m.tiempoDescanso_s)} en total)`)
  L.push('')
  L.push('LARGOS')
  L.push('-'.repeat(72))
  L.push(`${der('#', 3)}  ${col('Sentido', 12)}${col('Inicio', 10)}${der('Tiempo', 9)}${der('Velocidad', 12)}${der('Pausa antes', 13)}  Registro`)
  for (const l of d.largos) {
    L.push(
      `${der(String(l.numero), 3)}  ${col(`${l.desde_m}->${l.hasta_m} m`, 12)}${col(hora(ms(l.t_inicio)), 10)}${der(formatearSegundos(l.duracion_s), 9)}` +
        `${der(formatearVel(l.velocidad_ms), 12)}${der(l.pausa_previa_s === null ? '—' : formatearSegundos(l.pausa_previa_s), 13)}  ${l.estimado ? 'ESTIMADO' : 'detectado'}`,
    )
  }
  if (!d.largos.length) L.push('  (ningún largo completo: no se vio al nadador ir de una pared a la otra)')
  L.push('')
  L.push('TRAMOS (de marca a marca)')
  L.push('-'.repeat(72))
  L.push(`${col('Tramo', 14)}${col('Inicio', 10)}${der('Tiempo', 9)}${der('Distancia', 11)}${der('Velocidad', 12)}  Registro`)
  for (const t of [...d.tramos].sort((a, b) => ms(a.t_inicio) - ms(b.t_inicio))) {
    L.push(
      `${col(`${t.nodo_desde_m}->${t.nodo_hasta_m} m`, 14)}${col(hora(ms(t.t_inicio)), 10)}${der(formatearSegundos(duracionTramo_s(t)), 9)}` +
        `${der(`${t.distancia_m} m`, 11)}${der(formatearVel(t.velocidad_ms), 12)}  ${t.observado ? 'detectado' : 'ESTIMADO'}`,
    )
  }
  L.push('')
  L.push('NOTAS')
  L.push('-'.repeat(72))
  L.push('* ESTIMADO: en algún momento la cámara no veía al nadador (salpicadura, otro nadador delante, o la')
  L.push('  zona de la pared que la cámara no ve) y el instante se calculó con su velocidad. No es una medición')
  L.push('  confirmada y no se usa para los récords (mejor/peor largo).')
  L.push('* Un largo solo cuenta si se ve al nadador ir de una pared a la otra sin cortes. Los tramos sueltos')
  L.push('  igual suman a la distancia medida.')
  L.push('* Consistencia: cuánto varían los tiempos de largo entre sí. Menos de 3 % es muy parejo.')
  return L.join('\n') + '\n'
}

/** El historial como CSV (se abre con Excel / Google Sheets). */
export function historialCsv(filas: FilaSesion[]): string {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const cab = ['fecha', 'hora_inicio', 'duracion_s', 'carriles', 'estado', 'distancia_m', 'velocidad_media_ms', 'velocidad_max_ms', 'largos', 'largos_medidos', 'mejor_largo_s']
  const L = [cab.join(',')]
  for (const f of filas) {
    L.push(
      [
        new Date(f.sesion.inicio).toISOString().slice(0, 10),
        horaCorta(f.sesion.inicio),
        f.duracion_s === null ? '' : f.duracion_s.toFixed(0),
        f.carriles.join(' '),
        f.sesion.estado,
        f.distancia_m.toFixed(1),
        f.velocidad_media_ms?.toFixed(3) ?? '',
        f.velocidad_max_ms?.toFixed(3) ?? '',
        String(f.largos),
        String(f.largos_medidos),
        f.mejor_largo_s?.toFixed(2) ?? '',
      ]
        .map(esc)
        .join(','),
    )
  }
  return L.join('\n') + '\n'
}

/** Descarga un texto como archivo. */
export function descargarTexto(nombre: string, texto: string, tipo = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([texto], { type: `${tipo};charset=utf-8` }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
