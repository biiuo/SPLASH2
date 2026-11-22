import { createHash } from 'node:crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const esUuid = (valor: unknown): valor is string => typeof valor === 'string' && UUID.test(valor)

/**
 * Un UUID que sale siempre igual de las mismas partes. Así, si el celular reenvía un lote (por una desconexión),
 * cada evento vuelve a tener el mismo id y la base lo reconoce como repetido en vez de duplicarlo.
 */
export function idDeterminista(...partes: Array<string | number>): string {
  const h = createHash('sha1').update(partes.join('|')).digest()
  h[6] = (h[6] & 0x0f) | 0x50 // versión 5
  h[8] = (h[8] & 0x3f) | 0x80 // variante
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}
