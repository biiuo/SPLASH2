/** El último "estoy vivo" de cada componente (servidor de IA, celulares) con su estado. */
export type Latido = { componente: string; estado: Record<string, unknown>; ultimo_latido: string }

export interface LatidoRepository {
  /** Guarda (o reemplaza) el latido de un componente con la hora actual. */
  registrar(componente: string, estado: Record<string, unknown>): Promise<void>
  listar(): Promise<Latido[]>
}

export const LATIDO_REPOSITORY = Symbol('LatidoRepository')
