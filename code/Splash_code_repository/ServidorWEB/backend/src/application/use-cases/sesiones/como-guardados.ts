import type { EventoGuardado, TramoGuardado } from '../../../domain/entities/sesion.entity'
import type { EventoParaGuardar, TramoParaGuardar } from '../../../domain/repositories/resultados.repository'

const redondear = (v: number, decimales: number) => Math.round(v * 10 ** decimales) / 10 ** decimales

/** Lo que devolvería GET /resultados para estos eventos y tramos (mismas fechas y mismos redondeos que la base). */
export function eventoComoGuardado(e: EventoParaGuardar): EventoGuardado {
  return {
    id: e.id,
    carril: e.carril,
    identidad: e.identidad,
    tipo: e.tipo,
    nodo_m: e.nodo_m === null ? null : redondear(e.nodo_m, 2),
    ts_captura: new Date(Math.round(e.t)).toISOString(),
    observado: e.observado,
  }
}

export function tramoComoGuardado(t: TramoParaGuardar): TramoGuardado {
  return {
    id: t.id,
    carril: t.carril,
    identidad: t.identidad,
    nodo_desde_m: redondear(t.nodo_desde_m, 2),
    nodo_hasta_m: redondear(t.nodo_hasta_m, 2),
    t_inicio: new Date(Math.round(t.t_inicio)).toISOString(),
    t_fin: new Date(Math.round(t.t_fin)).toISOString(),
    distancia_m: redondear(t.distancia_m, 2),
    velocidad_ms: redondear(t.velocidad_ms, 3),
    observado: t.observado,
  }
}
