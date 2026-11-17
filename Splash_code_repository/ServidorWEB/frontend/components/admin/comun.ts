// Cuentas que comparten las páginas del administrador.
import type { ResumenSesion } from '@/lib/tipos'

/** Mismo criterio que el backend: terminó sin tramos, o más de la mitad de sus tramos son estimados. */
export function conErrores(s: ResumenSesion): boolean {
  if (s.estado !== 'finalizada') return false
  const tramos = s.por_carril.reduce((a, c) => a + c.tramos, 0)
  const estimados = s.por_carril.reduce((a, c) => a + c.tramos_estimados, 0)
  return tramos === 0 || estimados / tramos > 0.5
}

export const tramosDe = (s: ResumenSesion) => s.por_carril.reduce((a, c) => a + c.tramos, 0)
export const estimadosDe = (s: ResumenSesion) => s.por_carril.reduce((a, c) => a + c.tramos_estimados, 0)

/** Estadísticas de una persona (por su cuenta) a partir de las sesiones: en cuántas nadó, metros y mejor velocidad. */
export function estadisticasDe(usuarioId: string, sesiones: ResumenSesion[]) {
  const carriles = sesiones.flatMap((s) => s.por_carril.filter((c) => c.usuario_id === usuarioId).map((c) => ({ s, c })))
  const maxima = carriles.map((x) => x.c.velocidad_max_ms).filter((v): v is number => v !== null)
  return {
    sesiones: new Set(carriles.map((x) => x.s.id)).size,
    distancia_m: carriles.reduce((a, x) => a + x.c.distancia_m, 0),
    largos: carriles.reduce((a, x) => a + x.c.largos, 0),
    velocidad_max_ms: maxima.length ? Math.max(...maxima) : null,
    ultima: carriles.map((x) => x.s.inicio).sort().at(-1) ?? null,
  }
}
