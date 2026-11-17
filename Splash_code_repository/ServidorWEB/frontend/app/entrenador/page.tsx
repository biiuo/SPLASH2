'use client'

import { Activity, AlertTriangle, CheckCircle2, PlayCircle, Users } from 'lucide-react'
import Link from 'next/link'

import { conErrores } from '@/components/admin/comun'
import { carrilesDe, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, EstadoSesion, Kpi, Tarjeta } from '@/components/nadador/ui'
import { SesionPanel } from '@/components/sesion-panel'
import { useCuenta } from '@/lib/cuenta'
import { fechaCorta, formatearMetros, formatearVel, horaCorta } from '@/lib/largos'
import { cumplimiento, NOMBRE_TIPO } from '@/lib/objetivos'

const DIA = 24 * 60 * 60 * 1000
const hoy = () => new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Dashboard del entrenador: su grupo de un vistazo, alertas y las últimas sesiones. */
export default function DashboardEntrenador() {
  const { usuario } = useCuenta()
  const { datos, problema } = useDatosEntrenador()
  const inicioHoy = new Date().setHours(0, 0, 0, 0)
  const sesiones = datos?.sesiones ?? []
  const deHoy = sesiones.filter((s) => Date.parse(s.inicio) >= inicioHoy)
  const semana = sesiones.filter((s) => Date.parse(s.inicio) >= Date.now() - 7 * DIA && s.estado !== 'cancelada')
  const rendimiento = metricas(semana.flatMap((s) => s.por_carril.map((c) => ({ sesion: s, carril: c }))))

  // alertas: lo que el entrenador debería mirar hoy
  const alertas: { texto: string; href?: string }[] = []
  if (datos) {
    for (const s of sesiones.filter((x) => Date.parse(x.inicio) >= Date.now() - 14 * DIA && conErrores(x)).slice(0, 5)) {
      alertas.push({ texto: `Sesión del ${fechaCorta(s.inicio)} con errores de detección (sin datos o con más de la mitad estimado).`, href: `/entrenador/historial/${s.id}` })
    }
    for (const s of sesiones.filter((x) => x.estado === 'activa')) {
      if (Date.now() - Date.parse(s.inicio) > 2 * 60000 && s.tramos === 0) alertas.push({ texto: `La sesión en curso de las ${horaCorta(s.inicio)} todavía no tiene datos.`, href: '/entrenador/monitoreo' })
    }
    for (const n of datos.nadadores) {
      const ultima = metricas(carrilesDe(n.usuario_id, sesiones)).ultima
      if (!ultima || Date.parse(ultima) < Date.now() - 14 * DIA) alertas.push({ texto: `${n.nombre} no entrena con vos hace más de 14 días.`, href: `/entrenador/nadadores/${n.id}` })
    }
    for (const o of datos.objetivos) {
      const c = cumplimiento(o, sesiones)
      const faltan = (Date.parse(`${o.hasta}T23:59:59`) - Date.now()) / DIA
      if (c.estado === 'en_curso' && faltan <= 7) alertas.push({ texto: `${o.nadador}: ${NOMBRE_TIPO[o.tipo].toLowerCase()} al ${c.porcentaje} %, vence en ${Math.max(0, Math.ceil(faltan))} días.`, href: '/entrenador/objetivos' })
    }
  }

  return (
    <>
      <p className="text-sm capitalize text-[#94A3B8]">{hoy()}</p>
      <Encabezado titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? ''}`} bajada="El resumen de tu grupo y tus entrenamientos." />
      {problema && <div className="mb-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icono={Users} etiqueta="Nadadores asignados" valor={datos ? String(datos.nadadores.length) : '…'} nota="en tus grupos, sin repetir" />
        <Kpi icono={Activity} etiqueta="Sesiones de hoy" valor={datos ? String(deHoy.length) : '…'} />
        <Kpi icono={PlayCircle} etiqueta="Sesiones activas" valor={datos ? String(sesiones.filter((s) => s.estado === 'activa').length) : '…'} />
        <Kpi icono={CheckCircle2} etiqueta="Sesiones finalizadas" valor={datos ? String(sesiones.filter((s) => s.estado === 'finalizada').length) : '…'} />
      </div>

      <div className="mt-6">
        <SesionPanel />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Alertas" subtitulo="Lo que conviene revisar.">
          {datos && alertas.length === 0 && <Aviso>Sin alertas.</Aviso>}
          <ul className="flex flex-col gap-2">
            {alertas.slice(0, 8).map((a) => (
              <li key={a.texto} className="flex items-start gap-2 text-sm text-[#0F172A]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#B45309]" aria-hidden="true" />
                {a.href ? <Link href={a.href} className="hover:underline">{a.texto}</Link> : a.texto}
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Rendimiento del grupo" subtitulo="Últimos 7 días, todos tus nadadores.">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Dato k="Distancia" v={formatearMetros(rendimiento.distancia_m)} />
            <Dato k="Velocidad media" v={formatearVel(rendimiento.velocidad_media_ms)} />
            <Dato k="Mejor velocidad" v={formatearVel(rendimiento.velocidad_max_ms)} nota="largo detectado" />
            <Dato k="Largos completos" v={String(rendimiento.largos)} />
          </dl>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Últimas sesiones" className="mt-6" accion={<Link href="/entrenador/historial" className={BOTON.secundario}>Ver historial</Link>}>
        {datos && sesiones.length === 0 && <Aviso>Todavía no iniciaste sesiones.</Aviso>}
        <ul className="divide-y divide-[#F1F5F9]">
          {sesiones.slice(0, 6).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{fechaCorta(s.inicio)} {horaCorta(s.inicio)}{s.grupo ? ` · ${s.grupo}` : ' · libre'}</p>
                <p className="text-xs text-[#64748B]">{s.por_carril.map((c) => `${c.carril}: ${c.nadador ?? '—'}`).join(' · ') || 'sin carriles'} · {formatearMetros(s.distancia_m)}</p>
              </div>
              <div className="flex items-center gap-3">
                <EstadoSesion estado={s.estado} />
                <Link href={`/entrenador/historial/${s.id}`} className="text-xs font-semibold text-[#2563EB] hover:underline">Ver detalle</Link>
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </>
  )
}

function Dato({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div>
      <dt className="text-xs text-[#64748B]">{k}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{v}</dd>
      {nota && <dd className="text-xs text-[#94A3B8]">{nota}</dd>}
    </div>
  )
}
