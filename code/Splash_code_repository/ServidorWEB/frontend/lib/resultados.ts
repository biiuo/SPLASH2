// Cuentas simples sobre los resultados de una sesión, para mostrarlos. Los cálculos de verdad (metros, velocidades,
// cruces) los hace el backend; acá solo se agrupa y se da formato.
export { resumenPorCarril } from '@/domain/sesion/resumen-carriles'
export type { ResumenCarril } from '@/domain/sesion/resumen-carriles'

/** 83_000 ms -> «01:23»; desde una hora, «1:01:23». */
export function formatearDuracion(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dos = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`
}

export const formatearVelocidad = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} m/s`)
