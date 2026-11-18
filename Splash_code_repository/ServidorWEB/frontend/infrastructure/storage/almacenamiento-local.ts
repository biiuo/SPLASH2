/** Acceso al almacenamiento disponible tanto en el navegador como durante SSR. */
export function leerTexto(clave: string, valorPredeterminado: string | null = null): string | null {
  try {
    return typeof window === 'undefined' ? valorPredeterminado : window.localStorage.getItem(clave) ?? valorPredeterminado
  } catch {
    return valorPredeterminado
  }
}

export function guardarTexto(clave: string, valor: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(clave, valor)
  } catch {
    // El almacenamiento puede estar bloqueado por el navegador.
  }
}

export function eliminar(clave: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(clave)
  } catch {
    // El almacenamiento puede estar bloqueado por el navegador.
  }
}

export function leerJson<T>(clave: string, valorPredeterminado: T): T {
  const texto = leerTexto(clave)
  if (texto === null) return valorPredeterminado
  try {
    return JSON.parse(texto) as T
  } catch {
    return valorPredeterminado
  }
}

export function guardarJson(clave: string, valor: unknown): void {
  try {
    const texto = JSON.stringify(valor)
    if (texto !== undefined) guardarTexto(clave, texto)
  } catch {
    // Algunos valores, como las referencias circulares, no se pueden serializar.
  }
}
