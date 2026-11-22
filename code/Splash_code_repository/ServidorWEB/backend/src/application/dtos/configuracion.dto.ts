import type { ConfigCamara, ConfigPiscina, ConfigProcesamiento, Derivados, PrecisionNodo } from '../../domain/entities/configuracion.entity'
import type { ModoProceso } from '../../domain/entities/sesion.entity'

export type ConfiguracionDto = { piscina: ConfigPiscina; camara: ConfigCamara; procesamiento: ConfigProcesamiento }

/** La configuración que está en uso: la guardada, o la de fábrica si todavía no se guardó ninguna. */
export type ConfiguracionEfectivaDto = {
  configuracion: ConfiguracionDto
  guardada: boolean
  /** Los valores de fábrica, para poder volver a ellos. */
  fabrica: ConfiguracionDto
  /** Dónde se procesan las sesiones nuevas (lo elegido, o el del .env si no se eligió). */
  modo_procesamiento: ModoProceso
  /** El modo del .env del backend (PROCESAR_EN), el que se usa cuando no se elige ninguno. */
  modo_por_defecto: ModoProceso
}

/** Qué implica una configuración, sin guardarla: errores, valores calculados y precisión esperada. */
export type AnalisisConfiguracionDto = {
  errores: string[]
  derivados: Derivados | null
  precision: PrecisionNodo[]
  avisos: string[]
}
