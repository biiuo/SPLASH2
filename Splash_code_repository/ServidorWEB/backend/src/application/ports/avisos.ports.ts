// Avisos de lo que pasa en las sesiones, para quien esté escuchando en vivo (el servidor de IA y los paneles de la web).
// La aplicación solo publica; cómo llegan los avisos (SSE, en memoria, Redis...) es infraestructura.
import type { EventoGuardado, Sesion, TramoGuardado } from '../../domain/entities/sesion.entity'

export type AvisoSesion =
  | { tipo: 'sesion_iniciada'; sesion: Sesion }
  | { tipo: 'sesion_finalizada'; sesion: Sesion }
  /** Lo NUEVO que se midió en un lote (no todo el historial). Puede repetir ids si se reenvió un lote: se ignoran. */
  | { tipo: 'resultados'; sesion_id: string; eventos: EventoGuardado[]; tramos: TramoGuardado[] }
  /** Cambió qué carriles están tomados (empezó o terminó una sesión, o alguien se sumó). No dice de quién: cada uno pregunta. */
  | { tipo: 'carriles' }

export interface CanalAvisos {
  publicar(aviso: AvisoSesion): void
  /** Llama a `escuchar` con cada aviso nuevo. Devuelve la función para dejar de escuchar. */
  suscribir(escuchar: (aviso: AvisoSesion) => void): () => void
}

export const CANAL_AVISOS = Symbol('CanalAvisos')
