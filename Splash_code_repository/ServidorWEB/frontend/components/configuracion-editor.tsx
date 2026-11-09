'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import type { AnalisisConfiguracion, ConfigCamara, ConfigPiscina, Configuracion, ModoProceso } from '@/lib/tipos'

const NOMBRE_MODO: Record<ModoProceso, string> = { servidor: 'En el servidor', celular: 'En el celular' }

const OPCIONES_MODO: { valor: ModoProceso | null; ayuda: string }[] = [
  { valor: null, ayuda: 'Usa PROCESAR_EN del .env del backend. Sirve para que cada instalación tenga su valor.' },
  { valor: 'servidor', ayuda: 'El servidor de IA (ServidorIA/ProcesamientoServidor) procesa la cámara. Tiene que estar corriendo.' },
  {
    valor: 'celular',
    ayuda: 'Procesa el dispositivo que inicia la sesión, en el navegador. Hace falta servidor_stream.py y el modelo en ONNX. Si el navegador no puede, se usa el servidor.',
  },
]

const SENSORES = [
  { etiqueta: '1/3" (4,8 × 3,6 mm)', ancho: 4.8, alto: 3.6 },
  { etiqueta: '1/2.7" (5,37 × 4,04 mm)', ancho: 5.37, alto: 4.04 },
  { etiqueta: '1/2.8" (5,6 × 3,15 mm)', ancho: 5.6, alto: 3.15 },
]

function Campo({
  etiqueta,
  ayuda,
  valor,
  alCambiar,
  paso = 'any',
  sufijo,
}: {
  etiqueta: string
  ayuda?: string
  valor: number | null
  alCambiar: (n: number) => void
  paso?: string
  sufijo?: string
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {etiqueta}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          step={paso}
          value={valor !== null && Number.isFinite(valor) ? valor : ''}
          onChange={(e) => alCambiar(e.target.value === '' ? Number.NaN : Number(e.target.value))}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
        />
        {sufijo && <span className="text-sm text-slate-400">{sufijo}</span>}
      </div>
      {ayuda && <span className="mt-1 block text-xs font-normal text-slate-400">{ayuda}</span>}
    </label>
  )
}

export function ConfiguracionEditor() {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [fabrica, setFabrica] = useState<Configuracion | null>(null)
  const [modoPorDefecto, setModoPorDefecto] = useState<ModoProceso>('servidor')
  const [nodosTexto, setNodosTexto] = useState('')
  const [analisis, setAnalisis] = useState<AnalisisConfiguracion | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  // al abrir: la configuración que guardó el servidor (o la de fábrica si todavía no hay ninguna)
  useEffect(() => {
    api
      .configuracion()
      .then((e) => {
        setConfig(e.configuracion)
        setFabrica(e.fabrica)
        setModoPorDefecto(e.modo_por_defecto)
        setNodosTexto(e.configuracion.piscina.nodos_m.join(', '))
      })
      .catch((e: Error) => setFallo(e.message))
  }, [])

  // mientras se edita: el backend analiza los valores (con una pequeña espera para no pedir en cada tecla)
  useEffect(() => {
    if (!config) return
    let vigente = true
    const espera = setTimeout(() => {
      api
        .analizarConfiguracion(config)
        .then((a) => vigente && setAnalisis(a))
        .catch((e: Error) => vigente && setFallo(e.message))
    }, 250)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [config])

  const errores = analisis?.errores ?? []
  const valida = analisis !== null && errores.length === 0
  const dv = analisis?.derivados ?? null
  const precision = analisis?.precision ?? []
  const alertas = analisis?.avisos ?? []

  const piscina = (cambio: Partial<ConfigPiscina>) => setConfig((c) => c && { ...c, piscina: { ...c.piscina, ...cambio } })
  const camara = (cambio: Partial<ConfigCamara>) => setConfig((c) => c && { ...c, camara: { ...c.camara, ...cambio } })

  function cambiarNodos(texto: string) {
    setNodosTexto(texto)
    piscina({ nodos_m: texto.split(',').map((t) => (t.trim() === '' ? Number.NaN : Number(t.trim()))) })
  }

  async function guardar() {
    if (!config || !valida) return
    setGuardando(true)
    try {
      await api.guardarConfiguracion(config)
      setMensaje({ ok: true, texto: 'Configuración guardada. La usan la calibración y el servidor de IA.' })
    } catch (e) {
      const detalle = e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'Error desconocido.'
      setMensaje({ ok: false, texto: `No se pudo guardar: ${detalle}` })
    }
    setGuardando(false)
  }

  function restablecer() {
    if (!fabrica) return
    setConfig(fabrica)
    setNodosTexto(fabrica.piscina.nodos_m.join(', '))
    setMensaje({ ok: true, texto: 'Valores de fábrica cargados. Todavía no se guardaron: apretá "Guardar".' })
  }

  if (!config) {
    return (
      <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">← Volver al inicio</Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Configuración de la piscina y la cámara</h1>
          <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${fallo ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
            {fallo ?? 'Cargando…'}
          </p>
        </div>
      </main>
    )
  }

  const p = config.piscina
  const k = config.camara

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-blue-600">
          <Link href="/" className="hover:underline">← Volver al inicio</Link>
          <Link href="/calibracion" className="hover:underline">Calibración</Link>
          <Link href="/zonas" className="hover:underline">Zonas de análisis</Link>
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-blue-600">Entrenadores y administradores</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Configuración de la piscina y la cámara</h1>
        <p className="mt-2 max-w-3xl text-slate-500">
          Estos datos los usa la calibración para convertir la imagen en metros, y sirven para estimar qué tan precisas van a
          ser las medidas. Vienen cargados con los valores de la piscina de la universidad; cambialos si cambia el montaje.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_340px]">
          {/* ---- piscina ---- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Piscina</h2>
            <div className="mt-4 flex flex-col gap-4">
              <Campo etiqueta="Largo" valor={p.largo_m} alCambiar={(n) => piscina({ largo_m: n })} sufijo="m" />
              <Campo etiqueta="Ancho" valor={p.ancho_m} alCambiar={(n) => piscina({ ancho_m: n })} sufijo="m" />
              <Campo etiqueta="Cantidad de carriles" valor={p.n_carriles} alCambiar={(n) => piscina({ n_carriles: n })} paso="1" />
              <Campo
                etiqueta="Primer carril que se analiza"
                valor={p.primer_carril}
                alCambiar={(n) => piscina({ primer_carril: n })}
                paso="1"
              />
              <Campo
                etiqueta="Cuántos carriles se analizan"
                valor={p.n_carriles_analizados}
                alCambiar={(n) => piscina({ n_carriles_analizados: n })}
                paso="1"
                ayuda="Son consecutivos: por ejemplo, primer carril 4 y 3 carriles analizan el 4, 5 y 6."
              />
              <label className="block text-sm font-medium text-slate-700">
                Marcas de las cuerdas (distancia desde la pared de salida)
                <input
                  value={nodosTexto}
                  onChange={(e) => cambiarNodos(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  En metros, separadas por comas. Dejá solo las que realmente se ven en la cuerda (cambios de color, banderines).
                </span>
              </label>
            </div>
          </section>

          {/* ---- cámara ---- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Cámara</h2>
            <div className="mt-4 flex flex-col gap-4">
              <label className="block text-sm font-medium text-slate-700">
                Modelo
                <input
                  value={k.modelo}
                  onChange={(e) => camara({ modelo: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Tamaño del sensor
                <select
                  value={`${k.sensor_ancho_mm}x${k.sensor_alto_mm}`}
                  onChange={(e) => {
                    const s = SENSORES.find((x) => `${x.ancho}x${x.alto}` === e.target.value)
                    if (s) camara({ sensor_ancho_mm: s.ancho, sensor_alto_mm: s.alto })
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                >
                  {SENSORES.map((s) => (
                    <option key={s.etiqueta} value={`${s.ancho}x${s.alto}`}>
                      {s.etiqueta}
                    </option>
                  ))}
                  {!SENSORES.some((s) => s.ancho === k.sensor_ancho_mm && s.alto === k.sensor_alto_mm) && (
                    <option value={`${k.sensor_ancho_mm}x${k.sensor_alto_mm}`}>Personalizado</option>
                  )}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-400">El lente dice el formato (por ejemplo "1/3").</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Resolución: ancho" valor={k.ancho_px} alCambiar={(n) => camara({ ancho_px: n })} paso="1" sufijo="px" />
                <Campo etiqueta="Resolución: alto" valor={k.alto_px} alCambiar={(n) => camara({ alto_px: n })} paso="1" sufijo="px" />
              </div>
              <Campo
                etiqueta="Focal puesta en el lente (zoom)"
                valor={k.focal_mm}
                alCambiar={(n) => camara({ focal_mm: n })}
                sufijo="mm"
                ayuda="Es la que marca la perilla del zoom (de 2,8 a 8 mm en este lente). Si se mueve el zoom, hay que recalibrar."
              />
              <Campo
                etiqueta="Altura sobre el agua"
                valor={k.altura_m}
                alCambiar={(n) => camara({ altura_m: n })}
                sufijo="m"
              />
              <Campo
                etiqueta="Distancia horizontal al borde cercano"
                valor={k.distancia_borde_m}
                alCambiar={(n) => camara({ distancia_borde_m: n })}
                sufijo="m"
                ayuda="Hasta la línea de 0 m. Con las marcas dibujadas sobre la foto salió entre 6,2 y 7,0 m (con cinta se midieron 5 m)."
              />
              <Campo
                etiqueta="Inclinación hacia abajo (opcional)"
                valor={k.inclinacion_grados}
                alCambiar={(n) => camara({ inclinacion_grados: Number.isNaN(n) ? null : n })}
                sufijo="°"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Procesamiento</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dónde corre el modelo en las sesiones nuevas. Los dos procesan los 3 carriles y miden lo mismo.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {OPCIONES_MODO.map((o) => {
                const elegido = (config.procesamiento?.modo ?? null) === o.valor
                return (
                  <label
                    key={String(o.valor)}
                    className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${elegido ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
                  >
                    <input
                      type="radio"
                      name="modo-procesamiento"
                      checked={elegido}
                      onChange={() => setConfig((c) => c && { ...c, procesamiento: { modo: o.valor } })}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-slate-800">
                        {o.valor === null ? `Según el archivo .env (hoy: ${NOMBRE_MODO[modoPorDefecto].toLowerCase()})` : NOMBRE_MODO[o.valor]}
                      </span>
                      <span className="block text-slate-500">{o.ayuda}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          {/* ---- resultados ---- */}
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Lo que sale de estos datos</h2>
              {dv ? (
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-slate-500">Ancho de un carril</dt>
                  <dd className="font-medium">{dv.anchoCarril_m.toFixed(4)} m</dd>
                  <dt className="text-slate-500">Ancho de los carriles analizados</dt>
                  <dd className="font-medium">{dv.anchoAnalizado_m.toFixed(4)} m</dd>
                  <dt className="text-slate-500">Focal en píxeles</dt>
                  <dd className="font-medium">{dv.focalPx.toFixed(0)} px</dd>
                  <dt className="text-slate-500">Ángulo de visión</dt>
                  <dd className="font-medium">
                    {dv.fovHorizontal.toFixed(0)}° × {dv.fovVertical.toFixed(0)}°
                  </dd>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Corregí los errores para ver los valores.</p>
              )}
            </section>

            {valida && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">Precisión esperada</h2>
                <p className="mt-1 text-xs text-slate-400">Error de posición por cada píxel mal marcado, a lo largo del carril.</p>
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {precision.map((f) => (
                      <tr key={f.nodo_m} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-500">{f.nodo_m} m</td>
                        <td className="py-1.5 text-right font-medium">{f.cm_por_px.toFixed(1)} cm</td>
                        <td className="py-1.5 text-right text-xs text-slate-400">{f.s_por_px.toFixed(2)} s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">Los segundos son el error de tiempo a 1,5 m/s. Es una estimación.</p>
              </section>
            )}

            {errores.length > 0 && (
              <ul className="list-disc space-y-1 rounded-2xl border border-rose-200 bg-rose-50 py-4 pl-9 pr-5 text-sm text-rose-800">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {alertas.length > 0 && (
              <ul className="list-disc space-y-1 rounded-2xl border border-amber-200 bg-amber-50 py-4 pl-9 pr-5 text-sm text-amber-800">
                {alertas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={guardar}
                disabled={!valida || guardando}
                className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                {guardando ? 'Guardando…' : 'Guardar configuración'}
              </button>
              <button
                onClick={restablecer}
                className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Volver a los valores de fábrica
              </button>
            </div>
            {mensaje && (
              <p className={`rounded-xl px-4 py-3 text-sm ${mensaje.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                {mensaje.texto}
              </p>
            )}
            <p className="text-xs text-slate-400">
              Esta pantalla es para entrenadores y administradores. Por ahora el acceso solo se oculta en la interfaz; el control real
              por rol llega con el inicio de sesión.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
