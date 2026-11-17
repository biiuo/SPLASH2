'use client'

import { ArrowLeft, Gauge, Timer, TrendingUp, Waves } from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'

import { carrilesDe, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { ProgresoObjetivo } from '@/components/entrenador/progreso-objetivo'
import { Linea } from '@/components/graficos'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, EstadoSesion, Kpi, Tarjeta } from '@/components/nadador/ui'
import { fechaCorta, formatearMetros, formatearSegundos, formatearVel, horaCorta } from '@/lib/largos'
import { cumplimiento } from '@/lib/objetivos'

const diaCorto = (t: number) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/** Perfil deportivo de un nadador de mis grupos: marcas, evolución, objetivos e historial. */
export default function PerfilNadador({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { datos, problema } = useDatosEntrenador()
  const n = datos?.nadadores.find((x) => x.id === id) ?? null
  const filas = n && datos ? carrilesDe(n.usuario_id, datos.sesiones).filter((f) => f.sesion.estado !== 'cancelada') : []
  const m = metricas(filas)
  const porSesion = [...filas].sort((a, b) => a.sesion.inicio.localeCompare(b.sesion.inicio))
  const conVel = porSesion.filter((f) => f.carril.velocidad_media_ms !== null)
  const mayorDistancia = filas.reduce<(typeof filas)[number] | null>((a, f) => (!a || f.carril.distancia_m > a.carril.distancia_m ? f : a), null)
  const grupos = datos?.grupos.filter((g) => g.nadadores.some((x) => x.id === id)) ?? []
  const objetivos = datos?.objetivos.filter((o) => o.nadador_id === id) ?? []

  return (
    <>
      <Link href="/entrenador/nadadores" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline"><ArrowLeft className="size-4" /> Mis nadadores</Link>
      {problema && <Aviso tipo="error">{problema}</Aviso>}
      {datos && !n && <Aviso>Ese nadador no está en tus grupos.</Aviso>}
      {n && datos && (
        <>
          <Encabezado
            titulo={n.nombre}
            bajada={`${n.email ?? 'sin cuenta'}${n.telefono ? ` · ${n.telefono}` : ''} · ${grupos.map((g) => g.nombre).join(', ') || 'sin grupo'}`}
            accion={<Link href={`/entrenador/rendimiento?nadador=${n.id}`} className={BOTON.secundario}>Analizar rendimiento</Link>}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icono={Waves} etiqueta="Distancia total" valor={Math.round(m.distancia_m).toLocaleString('es-CO')} unidad="m" nota={`${m.sesiones} sesiones · ${m.largos} largos`} />
            <Kpi icono={Gauge} etiqueta="Velocidad media" valor={m.velocidad_media_ms ? m.velocidad_media_ms.toFixed(2) : '—'} unidad="m/s" />
            <Kpi icono={TrendingUp} etiqueta="Mejor velocidad" valor={m.velocidad_max_ms ? m.velocidad_max_ms.toFixed(2) : '—'} unidad="m/s" nota="mejor marca, largo detectado" />
            <Kpi icono={Timer} etiqueta="Mejor largo" valor={formatearSegundos(m.mejor_largo_s)} nota="mejor marca, largo detectado" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Tarjeta titulo="Evolución de la velocidad" subtitulo="Velocidad media de cada sesión.">
              {conVel.length ? (
                <Linea
                  puntos={conVel.map((f) => ({ clave: f.sesion.id + f.carril.carril, x: Date.parse(f.sesion.inicio), y: f.carril.velocidad_media_ms as number, detalle: [formatearVel(f.carril.velocidad_media_ms), `${fechaCorta(f.sesion.inicio)} ${horaCorta(f.sesion.inicio)}`, formatearMetros(f.carril.distancia_m)] }))}
                  formatoY={(v) => v.toFixed(2)}
                  marcasX={conVel.filter((_, i) => i % Math.ceil(conVel.length / 5) === 0).map((f) => ({ x: Date.parse(f.sesion.inicio), texto: diaCorto(Date.parse(f.sesion.inicio)) }))}
                  etiquetaX="fecha · m/s"
                  descripcion={`Velocidad media por sesión de ${n.nombre}`}
                />
              ) : <Aviso>Todavía no hay sesiones con tramos medidos.</Aviso>}
            </Tarjeta>
            <Tarjeta titulo="Mejores marcas" subtitulo="Solo con largos detectados (los estimados no cuentan).">
              <dl className="grid gap-3 text-sm">
                <Marca k="Mejor tiempo de largo" v={formatearSegundos(m.mejor_largo_s)} />
                <Marca k="Mejor velocidad de largo" v={formatearVel(m.velocidad_max_ms)} />
                <Marca k="Mayor distancia en una sesión" v={mayorDistancia ? `${formatearMetros(mayorDistancia.carril.distancia_m)} · ${fechaCorta(mayorDistancia.sesion.inicio)}` : '—'} />
                <Marca k="Tramos estimados" v={m.estimados_pct === null ? '—' : `${Math.round(m.estimados_pct)} %`} />
              </dl>
            </Tarjeta>
          </div>

          <Tarjeta titulo="Objetivos" className="mt-6" accion={<Link href={`/entrenador/objetivos?nadador=${n.id}`} className={BOTON.secundario}>Gestionar objetivos</Link>}>
            {objetivos.length === 0 ? <Aviso>Sin objetivos todavía.</Aviso> : (
              <div className="flex flex-col gap-4">{objetivos.map((o) => <ProgresoObjetivo key={o.id} o={o} c={cumplimiento(o, datos.sesiones)} />)}</div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Historial de entrenamientos" className="mt-6">
            {filas.length === 0 ? <Aviso>Sin sesiones con vos todavía.</Aviso> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm tabular-nums">
                  <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Fecha</th><th className="py-2 pr-4">Carril</th><th className="py-2 pr-4 text-right">Distancia</th><th className="py-2 pr-4 text-right">Velocidad</th><th className="py-2 pr-4 text-right">Largos</th><th className="py-2 pr-4 text-right">Mejor largo</th><th className="py-2 pr-4">Estado</th><th className="py-2" /></tr></thead>
                  <tbody>
                    {[...porSesion].reverse().map((f) => (
                      <tr key={f.sesion.id + f.carril.carril} className="border-t border-[#F1F5F9]">
                        <td className="py-2.5 pr-4">{fechaCorta(f.sesion.inicio)} <span className="text-[#94A3B8]">{horaCorta(f.sesion.inicio)}</span></td>
                        <td className="py-2.5 pr-4">{f.carril.carril}</td>
                        <td className="py-2.5 pr-4 text-right">{formatearMetros(f.carril.distancia_m)}</td>
                        <td className="py-2.5 pr-4 text-right">{formatearVel(f.carril.velocidad_media_ms)}</td>
                        <td className="py-2.5 pr-4 text-right">{f.carril.largos}</td>
                        <td className="py-2.5 pr-4 text-right">{formatearSegundos(f.carril.mejor_largo_s)}</td>
                        <td className="py-2.5 pr-4"><EstadoSesion estado={f.sesion.estado} /></td>
                        <td className="py-2.5 text-right"><Link href={`/entrenador/historial/${f.sesion.id}?carril=${f.carril.carril}`} className="text-xs font-semibold text-[#2563EB] hover:underline">Ver largos</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </>
  )
}

function Marca({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] pb-2">
      <dt className="text-[#64748B]">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  )
}
