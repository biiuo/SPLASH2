'use client'

import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Barras, Linea, marcasLineales } from '@/components/graficos'
import { GraficaVelocidad } from '@/components/grafica-velocidad'
import { ErrorApi, api } from '@/lib/api'
import { csvDeSesion, descargarCsv, nombreCsv } from '@/lib/csv-sesion'
import {
  aTexto,
  calcularMetricas,
  descargarTexto,
  duracionTramo_s,
  fechaCorta,
  formatearMetros,
  formatearSegundos,
  formatearVel,
  horaCorta,
} from '@/lib/largos'
import type { ResultadosSesion, ResumenSesion } from '@/lib/tipos'

import { Aviso, BOTON, EstadoSesion, Registro, Tarjeta } from './ui'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * Todo lo de una sesión para un carril: resumen, tiempo y velocidad por largo, la tabla de rendimiento (detectado o
 * estimado) y la descarga en .txt. Lo usan el nadador (sus sesiones) y el entrenador (cualquier carril de las suyas).
 */
export function DetalleSesion({ sesion, carrilInicial }: { sesion: ResumenSesion; carrilInicial?: number | null }) {
  const carriles = sesion.por_carril
  const [carril, setCarril] = useState<number | null>(
    carrilInicial ?? (carriles.find((c) => c.tramos > 0) ?? carriles[0])?.carril ?? null,
  )
  const [carga, setCarga] = useState<{ id: string; resultados: ResultadosSesion | null; problema: string | null; ahora: number } | null>(null)
  const resultados = carga?.id === sesion.id ? carga.resultados : null
  const problema = carga?.id === sesion.id ? carga.problema : null
  const ahora = carga?.id === sesion.id ? carga.ahora : 0

  useEffect(() => {
    let vigente = true
    api
      .resultadosSesion(sesion.id)
      .then((r) => {
        if (vigente) setCarga({ id: sesion.id, resultados: r, problema: null, ahora: Date.now() })
      })
      .catch((e) => {
        if (vigente) setCarga({ id: sesion.id, resultados: null, problema: e instanceof ErrorApi ? e.message : 'No se pudieron cargar los resultados.', ahora: Date.now() })
      })
    return () => {
      vigente = false
    }
  }, [sesion.id])

  const nadador = carriles.find((c) => c.carril === carril)?.nadador ?? null
  const datos = useMemo(() => {
    if (!resultados || carril === null) return null
    const tramos = resultados.tramos.filter((t) => t.carril === carril)
    const eventos = resultados.eventos.filter((e) => e.carril === carril)
    const largos = resultados.largos.filter((l) => l.carril === carril)
    const fin = sesion.fin ? Date.parse(sesion.fin) : ahora
    return { tramos, eventos, largos, metricas: calcularMetricas(largos, tramos, eventos, resultados.largo_m, fin) }
  }, [resultados, carril, sesion.fin, ahora])

  function descargar() {
    if (!datos || !resultados || carril === null) return
    const texto = aTexto({ sesion: `${fechaCorta(sesion.inicio)} ${horaCorta(sesion.inicio)} (${sesion.id.slice(0, 8)})`, carril, nadador, largo_m: resultados.largo_m, ...datos })
    descargarTexto(`safesplash_${sesion.inicio.slice(0, 10)}_carril${carril}${nadador ? `_${nadador.replace(/\s+/g, '_')}` : ''}.txt`, texto)
  }

  if (problema) return <Aviso tipo="error">{problema}</Aviso>
  if (!datos || !resultados) return <p className="text-sm text-[#64748B]">Cargando…</p>

  const m = datos.metricas
  const carrilInfo = carriles.find((c) => c.carril === carril)
  const duracion = sesion.fin ? (Date.parse(sesion.fin) - Date.parse(sesion.inicio)) / 1000 : null
  const t0 = Date.parse(sesion.inicio)
  const largos = datos.largos
  const n = largos.length

  return (
    <div className="flex flex-col gap-6">
      {/* 1. resumen del entrenamiento */}
      <Tarjeta
        titulo="Resumen del entrenamiento"
        accion={
          <div className="flex flex-wrap items-center gap-2">
            {carriles.length > 1 && (
              <select value={carril ?? ''} onChange={(e) => { setCarril(Number(e.target.value)); setCarga((previo) => previo ? { ...previo, ahora: Date.now() } : previo) }} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Carril">
                {carriles.map((c) => (
                  <option key={c.carril} value={c.carril}>Carril {c.carril} · {c.nadador ?? 'sin nadador'}</option>
                ))}
              </select>
            )}
            <button onClick={descargar} className={BOTON.secundario}><Download className="size-4" /> Descargar .txt</button>
            <button
              onClick={() => descargarCsv(nombreCsv(sesion), csvDeSesion(sesion, resultados, Object.fromEntries(carriles.map((c) => [c.carril, c.nadador]))))}
              title="Eventos y tramos de la sesión (todos los carriles que puedas ver), para depurar"
              className={BOTON.terciario}
            >
              <Download className="size-4" /> CSV
            </button>
          </div>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <Dato k="Fecha" v={fechaCorta(sesion.inicio)} />
          <Dato k="Inicio y fin" v={`${horaCorta(sesion.inicio)} – ${sesion.fin ? horaCorta(sesion.fin) : 'en curso'}`} />
          <Dato k="Duración total" v={duracion === null ? 'En curso' : mmss(duracion)} />
          <Dato k="Estado" v={<EstadoSesion estado={sesion.estado} />} />
          <Dato k="Carril" v={`${carril ?? '—'}${nadador ? ` · ${nadador}` : ''}`} />
          <Dato k="Distancia total" v={formatearMetros(m.distancia_m)} />
          <Dato k="Velocidad promedio" v={formatearVel(carrilInfo?.velocidad_media_ms ?? null)} />
          <Dato k="Velocidad máxima" v={formatearVel(carrilInfo?.velocidad_max_ms ?? null)} nota="mejor largo detectado" />
          <Dato k="Largos" v={String(m.largos)} nota={m.largosEstimados ? `${m.largosEstimados} estimados` : undefined} />
          <Dato k="Mejor largo" v={formatearSegundos(m.mejorLargo?.duracion_s ?? null)} nota="solo detectados" />
          <Dato k="Ritmo cada 100 m" v={formatearSegundos(m.ritmo100_s)} />
          <Dato
            k="Consistencia"
            v={m.consistencia_pct === null ? '—' : `${m.consistencia_pct.toFixed(1)} %`}
            nota="variación entre largos"
          />
          <Dato
            k="2da mitad vs 1ra"
            v={m.cambioVelocidad_pct === null ? '—' : `${m.cambioVelocidad_pct > 0 ? '+' : ''}${m.cambioVelocidad_pct.toFixed(1)} %`}
            nota={m.cambioVelocidad_pct === null ? 'con 4 largos o más' : m.cambioVelocidad_pct < 0 ? 'más lento al final' : 'igual o más rápido al final'}
          />
          <Dato k="Descansos" v={String(m.descansos)} nota={`${formatearSegundos(m.tiempoDescanso_s)} en total`} />
          <Dato
            k="Tramos medidos"
            v={String(datos.tramos.length)}
            nota={(() => {
              const est = datos.tramos.filter((t) => !t.observado).length
              return est ? `${est} estimados (no se veía al nadador)` : 'todos detectados'
            })()}
          />
        </dl>
        {sesion.estado === 'activa' && <p className="mt-4 text-xs text-[#64748B]">La sesión sigue en curso: las métricas son parciales.</p>}
      </Tarjeta>

      {n === 0 ? (
        <Aviso tipo="estimado">
          Todavía no hay largos completos: hay {datos.tramos.length} tramos medidos, pero en ninguno se vio al nadador ir de una pared a la otra
          sin cortes (por ejemplo, si la cámara no lo vio salir de la pared). Los tramos sueltos sí suman a la distancia.
        </Aviso>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 2. tiempo por largo */}
            <Tarjeta titulo="Tiempo por largo" subtitulo="Cuánto tardó en cada largo. Más bajo = más rápido.">
              <Barras
                datos={largos.map((l) => ({
                  clave: String(l.numero),
                  etiqueta: String(l.numero),
                  valor: l.duracion_s,
                  estimado: l.estimado,
                  detalle: [formatearSegundos(l.duracion_s), `Largo ${l.numero} · ${l.desde_m}→${l.hasta_m} m`, `${formatearVel(l.velocidad_ms)}${l.estimado ? ' · estimado' : ''}`],
                }))}
                formatoY={(v) => `${v} s`}
                etiquetaX="número de largo"
                descripcion="Tiempo de cada largo, en segundos"
                referencia={m.largoPromedio_s ? { valor: m.largoPromedio_s, etiqueta: `promedio ${formatearSegundos(m.largoPromedio_s)}` } : undefined}
                destacar={m.mejorLargo ? String(m.mejorLargo.numero) : undefined}
              />
            </Tarjeta>

            {/* 3. velocidad por largo */}
            <Tarjeta titulo="Velocidad por largo" subtitulo="Cómo cambia la velocidad durante el entrenamiento.">
              <Linea
                puntos={largos.map((l) => ({
                  clave: String(l.numero),
                  x: l.numero,
                  y: l.velocidad_ms,
                  estimado: l.estimado,
                  detalle: [formatearVel(l.velocidad_ms), `Largo ${l.numero} · ${formatearSegundos(l.duracion_s)}`, l.estimado ? 'estimado (no confirmado)' : 'detectado'],
                }))}
                formatoY={(v) => v.toFixed(2)}
                marcasX={largos.filter((_, i) => i % Math.ceil(n / 12) === 0).map((l) => ({ x: l.numero, texto: String(l.numero) }))}
                etiquetaX="número de largo · m/s"
                descripcion="Velocidad de cada largo, en metros por segundo"
              />
            </Tarjeta>
          </div>

          <Tarjeta titulo="Largos a lo largo de la sesión" subtitulo="Cada punto es un largo terminado; pasá el mouse para ver su velocidad.">
            <Linea
              puntos={largos.map((l) => ({
                clave: String(l.numero),
                x: (Date.parse(l.t_fin) - t0) / 1000,
                y: l.numero,
                estimado: l.estimado,
                detalle: [formatearVel(l.velocidad_ms), `Largo ${l.numero} · ${formatearSegundos(l.duracion_s)}`, `terminó a los ${mmss((Date.parse(l.t_fin) - t0) / 1000)}`],
              }))}
              inicio={{ x: Math.max(0, (Date.parse(largos[0].t_inicio) - t0) / 1000), y: 0 }}
              formatoY={(v) => String(v)}
              ejeYEntero
              marcasX={marcasLineales(0, (Date.parse(largos[n - 1].t_fin) - t0) / 1000, mmss)}
              etiquetaX="tiempo desde el inicio de la sesión"
              descripcion="Largos acumulados contra el tiempo de la sesión"
              final={`${n} ${n === 1 ? 'largo' : 'largos'}`}
            />
          </Tarjeta>

          {/* 4. rendimiento por largo */}
          <Tarjeta titulo="Rendimiento por largo" subtitulo={`Cada largo son ${resultados.largo_m} m. «Estimado» = en algún momento no se veía al nadador: no es una medición confirmada.`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Largo</th>
                    <th className="py-2 pr-4 font-semibold">Sentido</th>
                    <th className="py-2 pr-4 text-right font-semibold">Tiempo</th>
                    <th className="py-2 pr-4 text-right font-semibold">Distancia</th>
                    <th className="py-2 pr-4 text-right font-semibold">Velocidad</th>
                    <th className="py-2 pr-4 text-right font-semibold">Pausa antes</th>
                    <th className="py-2 font-semibold">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {largos.map((l) => (
                    <tr key={l.numero} className={`border-t border-[#F1F5F9] ${l.estimado ? 'bg-[#FFF7ED]/50' : ''}`}>
                      <td className="py-2.5 pr-4 font-semibold">{l.numero}</td>
                      <td className="py-2.5 pr-4">{l.desde_m} → {l.hasta_m} m</td>
                      <td className="py-2.5 pr-4 text-right">{formatearSegundos(l.duracion_s)}</td>
                      <td className="py-2.5 pr-4 text-right">{resultados.largo_m} m</td>
                      <td className="py-2.5 pr-4 text-right">{formatearVel(l.velocidad_ms)}</td>
                      <td className="py-2.5 pr-4 text-right">{l.pausa_previa_s === null ? '—' : formatearSegundos(l.pausa_previa_s)}</td>
                      <td className="py-2.5"><Registro estimado={l.estimado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </>
      )}

      {/* velocidad de cada tramo a lo largo del tiempo, con el descanso en 0 (sale de los tramos: sirve aunque no haya largos completos) */}
      {datos.tramos.length > 0 && (
        <Tarjeta>
          <GraficaVelocidad
            tramos={datos.tramos}
            eventos={datos.eventos}
            inicio={t0}
            hasta={sesion.fin ? Date.parse(sesion.fin) : ahora}
            enCurso={sesion.estado === 'activa'}
            nadadores={{ [carril as number]: nadador }}
          />
        </Tarjeta>
      )}

      {/* los tramos (de marca a marca): de acá salen los largos */}
      {datos.tramos.length > 0 && (
        <Tarjeta>
          <details>
            <summary className="cursor-pointer font-semibold text-[#0F172A]">
              Tramos de marca a marca <span className="text-sm font-normal text-[#64748B]">({datos.tramos.length}, {datos.tramos.filter((t) => !t.observado).length} estimados)</span>
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Tramo</th>
                    <th className="py-2 pr-4 font-semibold">Hora</th>
                    <th className="py-2 pr-4 text-right font-semibold">Tiempo</th>
                    <th className="py-2 pr-4 text-right font-semibold">Distancia</th>
                    <th className="py-2 pr-4 text-right font-semibold">Velocidad</th>
                    <th className="py-2 font-semibold">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {[...datos.tramos].sort((a, b) => a.t_inicio.localeCompare(b.t_inicio)).map((t) => (
                    <tr key={t.id} className="border-t border-[#F1F5F9]">
                      <td className="py-2 pr-4">{t.nodo_desde_m} → {t.nodo_hasta_m} m</td>
                      <td className="py-2 pr-4">{new Date(t.t_inicio).toLocaleTimeString('es-CO', { hour12: false })}</td>
                      <td className="py-2 pr-4 text-right">{formatearSegundos(duracionTramo_s(t))}</td>
                      <td className="py-2 pr-4 text-right">{t.distancia_m} m</td>
                      <td className="py-2 pr-4 text-right">{formatearVel(t.velocidad_ms)}</td>
                      <td className="py-2"><Registro estimado={!t.observado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Tarjeta>
      )}
    </div>
  )
}

function Dato({ k, v, nota }: { k: string; v: React.ReactNode; nota?: string }) {
  return (
    <div>
      <dt className="text-xs text-[#64748B]">{k}</dt>
      <dd className="mt-0.5 font-semibold text-[#0F172A]">{v}</dd>
      {nota && <dd className="text-xs text-[#94A3B8]">{nota}</dd>}
    </div>
  )
}
