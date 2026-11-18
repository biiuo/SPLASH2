const PREFIJOS_CARRIL = ['lane', 'carril']

export function esCarril(nombre: string): boolean {
  const n = nombre.toLowerCase()
  return PREFIJOS_CARRIL.some((p) => n.startsWith(p))
}
