/**
 * Largos de un carril a partir de sus tramos (único lugar donde se calculan: el historial, los resultados y el
 * frontend usan esto, así todos cuentan igual).
 *
 * Un tramo va de una marca a la siguiente (0 -> 5 m...). Un LARGO es una cadena de tramos seguidos, en el mismo
 * sentido, de una pared a la otra (0 -> largo o largo -> 0). Si falta un pedazo (no se vio al nadador salir de la
 * pared, o se perdió en el medio) ese largo no se cuenta; sus tramos siguen contando para la distancia.
 *   tiempo del largo = fin del último tramo - inicio del primero
 *   velocidad        = largo de la piscina / tiempo
 * Un largo es "estimado" si alguno de sus tramos lo es (en algún momento no se veía al nadador). Los récords se
 * calculan solo con largos medidos.
 */

export type TramoParaLargos = {
  id: string
  carril: number
  nodo_desde_m: number
  nodo_hasta_m: number
  /** Milisegundos. */
  t_inicio: number
  t_fin: number
  observado: boolean
}

export type Largo = {
  numero: number
  carril: number
  desde_m: number
  hasta_m: number
  t_inicio: string
  t_fin: string
  duracion_s: number
  velocidad_ms: number
  /** true si algún tramo es estimado: no es una medición confirmada. */
  estimado: boolean
  /** Viraje + pausa desde el final del largo anterior. null en el primero. */
  pausa_previa_s: number | null
  /** Ids de los tramos que lo forman (trazabilidad: largo -> tramos -> eventos). */
  tramos: string[]
}

export type ResumenLargos = {
  largos: number
  /** Largos sin partes estimadas. */
  largos_medidos: number
  /** Mejor (menor) tiempo de largo, solo entre los medidos. */
  mejor_largo_s: number | null
  /** Mejor velocidad de largo, solo entre los medidos. */
  velocidad_max_ms: number | null
}

const EPS = 1e-6
const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Los largos completos de UN carril, en orden. `largo_m` = largo de la piscina (paredes en 0 y en largo_m). */
export function calcularLargos(tramos: TramoParaLargos[], largo_m: number): Largo[] {
  const ordenados = [...tramos].sort((a, b) => a.t_inicio - b.t_inicio)
  const esPared = (x: number) => Math.abs(x) < EPS || Math.abs(x - largo_m) < EPS
  const largos: Largo[] = []
  let cadena: TramoParaLargos[] | null = null

  for (const t of ordenados) {
    const sentido = Math.sign(t.nodo_hasta_m - t.nodo_desde_m)
    if (sentido === 0) continue
    const ultimo = cadena?.[cadena.length - 1]
    const sigue =
      ultimo !== undefined &&
      Math.abs(ultimo.nodo_hasta_m - t.nodo_desde_m) < EPS &&
      Math.sign(ultimo.nodo_hasta_m - ultimo.nodo_desde_m) === sentido
    if (sigue) cadena!.push(t)
    else if (esPared(t.nodo_desde_m)) cadena = [t]
    else {
      cadena = null // empezó en el medio: no se sabe de dónde salió
      continue
    }

    if (cadena && esPared(t.nodo_hasta_m) && Math.abs(t.nodo_hasta_m - cadena[0].nodo_desde_m) > EPS) {
      const inicio = cadena[0].t_inicio
      const duracion_s = (t.t_fin - inicio) / 1000
      const anterior = largos[largos.length - 1]
      if (duracion_s > 0) {
        largos.push({
          numero: largos.length + 1,
          carril: t.carril,
          desde_m: cadena[0].nodo_desde_m,
          hasta_m: t.nodo_hasta_m,
          t_inicio: new Date(inicio).toISOString(),
          t_fin: new Date(t.t_fin).toISOString(),
          duracion_s: r3(duracion_s),
          velocidad_ms: r3(largo_m / duracion_s),
          estimado: cadena.some((x) => !x.observado),
          pausa_previa_s: anterior ? r3(Math.max(0, (inicio - Date.parse(anterior.t_fin)) / 1000)) : null,
          tramos: cadena.map((x) => x.id),
        })
      }
      cadena = null
    }
  }
  return largos
}

/** Los largos de todos los carriles (cada carril por separado, numerados desde 1). */
export function largosPorCarril(tramos: TramoParaLargos[], largo_m: number): Largo[] {
  const carriles = [...new Set(tramos.map((t) => t.carril))].sort((a, b) => a - b)
  return carriles.flatMap((c) => calcularLargos(tramos.filter((t) => t.carril === c), largo_m))
}

export function resumirLargos(largos: Largo[]): ResumenLargos {
  const medidos = largos.filter((l) => !l.estimado)
  const mejor = medidos.reduce<Largo | null>((a, l) => (!a || l.duracion_s < a.duracion_s ? l : a), null)
  return {
    largos: largos.length,
    largos_medidos: medidos.length,
    mejor_largo_s: mejor?.duracion_s ?? null,
    velocidad_max_ms: mejor?.velocidad_ms ?? null,
  }
}

/** El largo de la piscina de una sesión: el de la geometría de su calibración, o 25 m si no se sabe. */
export function largoDePiscina(geometria: unknown): number {
  const v = (geometria as { largo_m?: unknown } | null)?.largo_m
  return typeof v === 'number' && v > 0 ? v : 25
}
