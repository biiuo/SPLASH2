'use client'

import { AlertTriangle, Camera, Cpu, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Encabezado } from '@/components/nadador/shell'
import { Aviso, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { formatearMetros, formatearVel, horaCorta } from '@/lib/largos'
import { formatearDuracion } from '@/lib/resultados'
import type { Monitoreo, ResumenSesion } from '@/lib/tipos'

const CADA_MS = 5000

/** Monitoreo en tiempo real: el servidor de IA (por su heartbeat), la cámara y las sesiones en curso. Se actualiza cada 5 s. */
export default function MonitoreoAdmin() {
  const [m, setM] = useState<Monitoreo | null>(null)
  const [medidas, setMedidas] = useState<ResumenSesion[]>([])
  const [problema, setProblema] = useState<string | null>(null)
  const [hora, setHora] = useState<number>(0)

  const cargar = useCallback(async () => {
    try {
      const [mon, lista] = await Promise.all([api.adminMonitoreo(), api.sesionesRecientes(30)])
      setM(mon)
      setMedidas(lista.filter((s) => s.estado === 'activa'))
      setProblema(null)
      setHora(Date.now())
    } catch (e) {
      setProblema(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.')
    }
  }, [])

  useEffect(() => {
    void cargar()
    const t = setInterval(() => void cargar(), CADA_MS)
    return () => clearInterval(t)
  }, [cargar])

  const ia = m?.componentes.find((c) => c.componente === 'ia') ?? null
  const alertas: string[] = []
  if (m) {
    if (!ia) alertas.push('El servidor de IA nunca avisó que está vivo: revisá que esté levantado y que tenga IA_TOKEN.')
    else if (!ia.vivo) alertas.push(`El servidor de IA no responde desde hace ${ia.hace_s} s.`)
    else {
      if (!ia.estado.camara_conectada) alertas.push('El servidor de IA no recibe video: la cámara no transmite.')
      if (m.activas.length && !ia.estado.procesando) alertas.push('Hay sesiones en curso pero el servidor de IA no está procesando.')
      if ((ia.estado.errores_envio ?? 0) > 0 && (ia.estado.pendientes_envio ?? 0) > 0) alertas.push(`El servidor de IA tiene ${ia.estado.pendientes_envio} posiciones sin poder enviar al backend.`)
    }
    for (const s of m.activas) {
      const datos = medidas.find((x) => x.id === s.id)
      const minutos = (Date.now() - Date.parse(s.inicio)) / 60000
      if (minutos > 2 && datos && datos.tramos === 0) alertas.push(`La sesión de ${s.iniciada_por ?? '—'} lleva ${Math.round(minutos)} min sin ningún tramo medido.`)
    }
  }

  return (
    <>
      <Encabezado
        titulo="Monitoreo en tiempo real"
        bajada="Se actualiza solo cada 5 segundos."
        accion={hora ? <span className="inline-flex items-center gap-1 text-xs text-[#94A3B8]"><RefreshCw className="size-3.5" /> {new Date(hora).toLocaleTimeString('es-CO')}</span> : undefined}
      />
      {problema && <div className="mb-4"><Aviso tipo="error">{problema}</Aviso></div>}

      {alertas.length > 0 && (
        <div role="alert" className="mb-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4">
          <p className="flex items-center gap-2 font-semibold text-[#991B1B]"><AlertTriangle className="size-4" /> Problemas detectados</p>
          <ul className="mt-2 list-disc pl-6 text-sm text-[#991B1B]">{alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="Servidor de IA">
          {!m ? <p className="text-sm text-[#64748B]">Cargando…</p> : !ia ? <Aviso>Sin latidos todavía.</Aviso> : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Estado k="Estado" ok={ia.vivo} si="En línea" no="No responde" icono={Cpu} />
              <Estado k="Procesando" ok={!!ia.estado.procesando} si="Sí" no="En pausa" icono={Cpu} />
              <Dato k="Procesamiento" v={`${ia.estado.fps ?? 0} fps`} nota="frames que pasan por el modelo" />
              <Dato k="Último latido" v={`hace ${ia.hace_s} s`} nota={horaCorta(ia.ultimo_latido)} />
              <Dato k="Nadadores siguiendo" v={String(ia.estado.identidades ?? 0)} />
              <Dato k="Zonas en uso" v={ia.estado.zonas ?? '—'} />
            </dl>
          )}
        </Tarjeta>
        <Tarjeta titulo="Cámara">
          {!m ? <p className="text-sm text-[#64748B]">Cargando…</p> : !ia ? <Aviso>Se conoce por el servidor de IA.</Aviso> : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Estado k="Video" ok={!!ia.estado.camara_conectada && ia.vivo} si="Transmitiendo" no="Sin video" icono={Camera} />
              <Dato k="Captura" v={`${ia.estado.fps_camara ?? 0} fps`} nota="frames que llegan de la cámara" />
              <Dato k="Sin enviar al backend" v={String(ia.estado.pendientes_envio ?? 0)} nota="posiciones en cola" />
              <Dato k="Errores de envío" v={String(ia.estado.errores_envio ?? 0)} />
            </dl>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-6" titulo="Sesiones en curso" subtitulo={m ? `${m.activas.length} ${m.activas.length === 1 ? 'sesión' : 'sesiones'}` : undefined}>
        {m?.activas.length === 0 && <Aviso>No hay sesiones en curso.</Aviso>}
        <div className="flex flex-col gap-3">
          {m?.activas.map((s) => {
            const datos = medidas.find((x) => x.id === s.id)
            return (
              <div key={s.id} className="rounded-xl border border-[#E2E8F0] p-4">
                <p className="font-semibold">{s.iniciada_por ?? '—'}{s.grupo ? ` · ${s.grupo}` : ' · sesión libre'} <span className="text-sm font-normal text-[#64748B]">· desde {horaCorta(s.inicio)} ({formatearDuracion(Date.now() - Date.parse(s.inicio))})</span></p>
                <table className="mt-2 w-full text-left text-sm tabular-nums">
                  <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-1 pr-4">Carril</th><th className="py-1 pr-4">Nadador</th><th className="py-1 pr-4 text-right">Tramos</th><th className="py-1 pr-4 text-right">Distancia</th><th className="py-1 text-right">Velocidad</th></tr></thead>
                  <tbody>
                    {s.carriles.map((c) => {
                      const d = datos?.por_carril.find((x) => x.carril === c.carril)
                      return (
                        <tr key={c.carril} className="border-t border-[#F1F5F9]">
                          <td className="py-1.5 pr-4">{c.carril}</td>
                          <td className="py-1.5 pr-4">{c.nadador ?? 'reservado'}</td>
                          <td className="py-1.5 pr-4 text-right">{d?.tramos ?? 0}</td>
                          <td className="py-1.5 pr-4 text-right">{formatearMetros(d?.distancia_m ?? 0)}</td>
                          <td className="py-1.5 text-right">{formatearVel(d?.velocidad_media_ms ?? null)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </Tarjeta>
    </>
  )
}

function Dato({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div>
      <dt className="text-xs text-[#64748B]">{k}</dt>
      <dd className="mt-0.5 font-semibold text-[#0F172A]">{v}</dd>
      {nota && <dd className="text-xs text-[#94A3B8]">{nota}</dd>}
    </div>
  )
}

function Estado({ k, ok, si, no, icono: Icono }: { k: string; ok: boolean; si: string; no: string; icono: typeof Cpu }) {
  return (
    <div>
      <dt className="text-xs text-[#64748B]">{k}</dt>
      <dd className="mt-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
          <Icono className="size-3.5" /> {ok ? si : no}
        </span>
      </dd>
    </div>
  )
}
