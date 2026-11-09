import type { AvisoSesion, CanalAvisos } from '../../application/ports/avisos.ports'

/**
 * Los avisos viven en la memoria de este proceso: alcanza mientras haya una sola copia del backend.
 * Con varias copias, habría que cambiar esta clase por una que use un intermediario (por ejemplo Redis pub/sub),
 * sin tocar nada más.
 */
export class AvisosEnMemoria implements CanalAvisos {
  private readonly oyentes = new Set<(aviso: AvisoSesion) => void>()

  publicar(aviso: AvisoSesion): void {
    for (const oyente of this.oyentes) {
      try {
        oyente(aviso)
      } catch {
        // un oyente con problemas (conexión cerrada a medias) no frena a los demás
      }
    }
  }

  suscribir(escuchar: (aviso: AvisoSesion) => void): () => void {
    this.oyentes.add(escuchar)
    return () => this.oyentes.delete(escuchar)
  }
}
