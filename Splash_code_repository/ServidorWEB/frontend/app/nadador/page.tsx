'use client'

import { Activity, Gauge, TrendingUp, Waves } from 'lucide-react'
import Link from 'next/link'

import { BOTON_HERO, CifraHero, HeroPanel } from '@/components/hero-panel'
import { TablaSesiones } from '@/components/nadador/tabla-sesiones'
import { Aviso, BOTON, EstadoSesion, Kpi, Tarjeta, useMisSesiones } from '@/components/nadador/ui'
import { SesionPanel } from '@/components/sesion-panel'
import { useCuenta } from '@/lib/cuenta'
import { fechaCorta, formatearMetros, formatearVel, horaCorta, totales } from '@/lib/largos'
import { formatearDuracion } from '@/lib/resultados'

const hoy = () => new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Mi resumen: indicadores, la última sesión y las cinco más recientes. */
export default function MiResumen() {
  const { usuario } = useCuenta()
  const { filas, problema } = useMisSesiones()
  const t = filas ? totales(filas.filter((f) => f.sesion.estado === 'finalizada')) : null
  const ultima = filas?.[0] ?? null

  return (
    <>
      <HeroPanel
        foto={1}
        etiqueta={hoy()}
        titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? ''}.`}
        resaltado="Cada largo cuenta."
        bajada="Aquí puedes consultar tu rendimiento y progreso."
        acciones={
          <>
            <Link href="/nadador/progreso" className={BOTON_HERO.claro}>Mi progreso</Link>
            <Link href="/nadador/sesiones" className={BOTON_HERO.vidrio}>Mis sesiones</Link>
          </>
        }
        lateral={t ? <CifraHero valor={`${Math.round(t.distancia_m).toLocaleString('es-CO')} m`} texto="nadados en total" /> : undefined}
      />

      <SesionPanel titulo="Tu sesión" vacia="No tenés una sesión en curso. Elegí un carril: podés sumarte a la sesión de un entrenador (de tu grupo, o libre) o empezar una sesión personal." />

      {problema && <div className="mt-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icono={Activity} etiqueta="Sesiones realizadas" valor={t ? String(t.sesiones) : '…'} nota="finalizadas" />
        <Kpi icono={Waves} etiqueta="Distancia recorrida" valor={t ? Math.round(t.distancia_m).toLocaleString('es-CO') : '…'} unidad="m" />
        <Kpi icono={Gauge} etiqueta="Velocidad promedio" valor={t?.velocidad_media_ms ? t.velocidad_media_ms.toFixed(2) : t ? '—' : '…'} unidad="m/s" />
        <Kpi icono={TrendingUp} etiqueta="Mejor velocidad" valor={t?.velocidad_max_ms ? t.velocidad_max_ms.toFixed(2) : t ? '—' : '…'} unidad="m/s" nota="mejor largo detectado" />
      </div>

      {ultima && (
        <Tarjeta
          titulo="Mi última sesión"
          className="mt-6"
          accion={<Link href={`/nadador/sesiones/${ultima.sesion.id}`} className={BOTON.primario}>Ver detalles</Link>}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
            <Dato k="Fecha" v={fechaCorta(ultima.sesion.inicio)} />
            <Dato k="Hora de inicio" v={horaCorta(ultima.sesion.inicio)} />
            <Dato k="Duración" v={ultima.duracion_s === null ? <EstadoSesion estado="activa" /> : formatearDuracion(ultima.duracion_s * 1000)} />
            <Dato k="Carril" v={ultima.carriles.join(', ') || '—'} />
            <Dato k="Distancia recorrida" v={formatearMetros(ultima.distancia_m)} />
            <Dato k="Velocidad promedio" v={formatearVel(ultima.velocidad_media_ms)} />
            <Dato k="Velocidad máxima" v={formatearVel(ultima.velocidad_max_ms)} />
            <Dato k="Largos" v={String(ultima.largos)} />
          </dl>
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Sesiones recientes"
        className="mt-6"
        accion={<Link href="/nadador/sesiones" className={BOTON.secundario}>Ver todas las sesiones</Link>}
      >
        {filas === null && !problema && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {filas?.length === 0 && <Aviso>Todavía no tenés sesiones. Aparecen acá cuando nadás en una.</Aviso>}
        {!!filas?.length && <TablaSesiones filas={filas.slice(0, 5)} />}
      </Tarjeta>
    </>
  )
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[#64748B]">{k}</dt>
      <dd className="mt-0.5 font-semibold text-[#0F172A]">{v}</dd>
    </div>
  )
}
