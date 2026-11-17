'use client'

import { Activity, AlertTriangle, CheckCircle2, PlayCircle, UserCog, Users } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Barras } from '@/components/graficos'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, EstadoSesion, Kpi, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { fechaCorta, formatearMetros, formatearVel, horaCorta } from '@/lib/largos'
import type { ResumenAdmin } from '@/lib/tipos'

const diaCorto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/** Dashboard: cómo está el sistema de un vistazo. */
export default function DashboardAdmin() {
  const [r, setR] = useState<ResumenAdmin | null>(null)
  const [problema, setProblema] = useState<string | null>(null)

  useEffect(() => {
    api.adminResumen().then(setR).catch((e) => setProblema(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.'))
  }, [])

  const rend = r?.rendimiento
  return (
    <>
      <Encabezado titulo="Dashboard" bajada="El funcionamiento del sistema de un vistazo." />
      {problema && <Aviso tipo="error">{problema}</Aviso>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi icono={Users} etiqueta="Nadadores registrados" valor={r ? String(r.usuarios.nadador) : '…'} nota="cuentas activas" />
        <Kpi icono={UserCog} etiqueta="Entrenadores" valor={r ? String(r.usuarios.entrenador) : '…'} nota="cuentas activas" />
        <Kpi icono={Activity} etiqueta="Sesiones realizadas" valor={r ? String(r.sesiones.total) : '…'} />
        <Kpi icono={PlayCircle} etiqueta="Sesiones activas" valor={r ? String(r.sesiones.activa) : '…'} />
        <Kpi icono={CheckCircle2} etiqueta="Sesiones finalizadas" valor={r ? String(r.sesiones.finalizada) : '…'} />
        <Kpi icono={AlertTriangle} etiqueta="Con errores de detección" valor={r ? String(r.sesiones.con_errores) : '…'} nota="sin tramos, o más de la mitad estimados" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Tarjeta titulo="Sesiones por día" subtitulo="Últimos 30 días.">
          {r && (
            <Barras
              datos={r.por_dia.map((d) => ({ clave: d.dia, etiqueta: diaCorto(d.dia), valor: d.sesiones, detalle: [`${d.sesiones} ${d.sesiones === 1 ? 'sesión' : 'sesiones'}`, diaCorto(d.dia)] }))}
              formatoY={(v) => String(v)}
              etiquetaX="día"
              descripcion="Sesiones por día en los últimos 30 días"
            />
          )}
        </Tarjeta>
        <Tarjeta titulo="Rendimiento general" subtitulo="De las últimas 500 sesiones, todos los nadadores.">
          {rend && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Dato k="Distancia medida" v={formatearMetros(rend.distancia_m)} />
              <Dato k="Velocidad media" v={formatearVel(rend.velocidad_media_ms)} />
              <Dato k="Largos completos" v={rend.largos.toLocaleString('es-CO')} />
              <Dato k="Tramos estimados" v={rend.tramos ? `${Math.round((rend.tramos_estimados / rend.tramos) * 100)} %` : '—'} nota={`${rend.tramos_estimados} de ${rend.tramos}`} />
            </dl>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Actividad reciente" className="mt-6" accion={<Link href="/admin/sesiones" className={BOTON.secundario}>Ver todas las sesiones</Link>}>
        {r?.recientes.length === 0 && <Aviso>Todavía no hay sesiones.</Aviso>}
        <ul className="divide-y divide-[#F1F5F9]">
          {r?.recientes.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium text-[#0F172A]">{s.iniciada_por ?? '—'}{s.grupo ? ` · ${s.grupo}` : ''}</p>
                <p className="text-xs text-[#64748B]">
                  {fechaCorta(s.inicio)} {horaCorta(s.inicio)} · carriles {s.por_carril.map((c) => c.carril).join(', ') || '—'} · {formatearMetros(s.distancia_m)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <EstadoSesion estado={s.estado} />
                <Link href={`/admin/sesiones/${s.id}`} className="text-xs font-semibold text-[#2563EB] hover:underline">Ver detalle</Link>
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
      <dd className="mt-0.5 text-lg font-semibold text-[#0F172A]">{v}</dd>
      {nota && <dd className="text-xs text-[#94A3B8]">{nota}</dd>}
    </div>
  )
}
