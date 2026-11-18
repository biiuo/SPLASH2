'use client'

import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Waves,
  X,
} from 'lucide-react'
import { ErrorApi } from '@/lib/api'
import { NOMBRE_ROL, useCuenta } from '@/lib/cuenta'

interface AuthScreenProps {
  mode: 'login' | 'signup'
  onBack: () => void
  onSignup: () => void
  onLogin: () => void
}

export function AuthScreen({ mode, onBack, onSignup, onLogin }: AuthScreenProps) {
  const isLogin = mode === 'login'
  const cuenta = useCuenta()

  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmarContrasena, setConfirmarContrasena] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [rol, setRol] = useState<'nadador' | 'entrenador'>('nadador')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [terminos, setTerminos] = useState(true)

  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])
  /** Entrenador recién registrado: espera la aprobación del administrador. */
  const [solicitudEnviada, setSolicitudEnviada] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErrores([])

    if (!isLogin) {
      if (!nombre.trim()) {
        setErrores(['Por favor ingresa tu nombre completo.'])
        return
      }
      if (contrasena.length < 8) {
        setErrores(['La contraseña debe tener al menos 8 caracteres.'])
        return
      }
      if (contrasena !== confirmarContrasena) {
        setErrores(['Las contraseñas no coinciden.'])
        return
      }
      if (!terminos) {
        setErrores(['Debes aceptar los Términos de Servicio y la Política de Privacidad.'])
        return
      }
    }

    setEnviando(true)
    try {
      if (isLogin) {
        await cuenta.ingresar(email.trim(), contrasena)
      } else {
        const r = await cuenta.registrarse({
          email: email.trim(),
          nombre: nombre.trim(),
          contrasena,
          rol,
          telefono: telefono.trim() || null,
        })
        if (r.pendiente) {
          setSolicitudEnviada(true)
          setContrasena('')
          setConfirmarContrasena('')
        }
      }
    } catch (err) {
      setErrores(
        err instanceof ErrorApi
          ? err.detalles.length > 0
            ? err.detalles
            : [err.message]
          : ['No se pudo conectar con el servidor.']
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 sm:px-8 py-8 text-white overflow-x-hidden bg-[#06182c]">
      {/* 1. Fotografía estática de fondo con desenfoque atmosférico */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/images/piscina/foto-piscina-3.jpeg"
          alt="Fondo piscina SafeSplash"
          className="w-full h-full object-cover object-center scale-105 blur-[10px] brightness-[0.62] saturate-125"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#041527]/70 via-[#082c4c]/45 to-[#04182e]/80" />
      </div>

      {/* 2. Tarjeta flotante Soft Translúcida */}
      <section className={`relative z-10 w-full ${isLogin ? 'max-w-[1080px]' : 'max-w-[920px]'} rounded-[30px] overflow-hidden shadow-[0_32px_90px_rgba(2,12,27,0.72)] border border-white/25 bg-[#082644]/40`}>
        {/* Fotografía estática nítida dentro de la tarjeta */}
        <img
          src="/images/piscina/foto-piscina-3.jpeg"
          alt="Carriles de natación SafeSplash"
          className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.88] saturate-[1.15]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#041629]/85 via-[#041629]/20 to-[#041629]/45 pointer-events-none" />

        <div className={`relative z-10 flex flex-col md:flex-row ${isLogin ? 'min-h-[640px]' : 'min-h-[560px]'}`}>
          {/* COLUMNA IZQUIERDA: Ventana limpia al agua + Bienvenida */}
          <div className="w-full md:w-[42%] p-8 sm:p-11 flex flex-col justify-between min-h-[210px] md:min-h-full">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2.5 text-left group cursor-pointer"
              title="Volver al inicio"
            >
              <div className="w-9 h-9 rounded-xl bg-[#1D63ED]/90 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-lg transition group-hover:scale-105">
                <Waves className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white">
                Safe<span className="text-sky-300">Splash</span>
              </span>
            </button>

            <div className="hidden md:block space-y-3.5 max-w-[290px]">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[11px] font-semibold text-sky-100">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-300" />
                Seguimiento óptico en piscina
              </span>
              <h2 className="text-2xl lg:text-[28px] font-extrabold text-white leading-snug">
                {isLogin ? (
                  <>
                    De vuelta al carril.<br />
                    <span className="text-sky-200">Supera tu marca.</span>
                  </>
                ) : (
                  <>
                    Tu carril te espera.<br />
                    <span className="text-sky-200">Únete al equipo.</span>
                  </>
                )}
              </h2>
              <p className="text-xs lg:text-sm text-sky-100/85 leading-relaxed">
                {isLogin
                  ? 'Consulta tus últimas sesiones en piscina, parciales por vuelta y métricas de rendimiento en tiempo real.'
                  : 'Regístrate para medir tus tiempos por tramo, sincronizar con tu entrenador y registrar cada brazada.'}
              </p>
            </div>
          </div>

          {/* COLUMNA DERECHA: Panel Soft Translúcido con curvatura S-Wave limpia */}
          <div className={`translucent-wave-pane w-full md:w-[60%] md:-ml-[2%] ${isLogin ? 'px-8 sm:px-14 md:pl-24 md:pr-14 py-10 sm:py-12' : 'px-6 sm:px-10 md:pl-20 md:pr-10 py-7 sm:py-8'} flex flex-col justify-center relative`}>
            <button
              type="button"
              onClick={onBack}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-[#06182c]/70 text-sky-100 shadow-lg backdrop-blur-md transition hover:border-white/50 hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
              aria-label="Cerrar y volver al inicio"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-full max-w-[420px] mx-auto">
              {/* Botón cerrar para móvil */}
              <button
                type="button"
                onClick={onBack}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-white/15 hover:text-white md:hidden cursor-pointer"
              >
                <X className="w-4 h-4" /> Cerrar
              </button>

              <div className="mb-7">
                <h1 className="text-2xl sm:text-[30px] font-extrabold text-white tracking-tight leading-tight">
                  {isLogin ? 'Hola de nuevo' : 'Crea tu cuenta'}
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-sky-100/80 leading-relaxed">
                  {isLogin
                    ? 'Ingresa tu correo y contraseña para acceder a tus carriles.'
                    : 'Ingresa tus datos para empezar a medir tu rendimiento.'}
                </p>
              </div>

              {solicitudEnviada ? (
                <div role="status" className="rounded-3xl border border-emerald-300/40 bg-emerald-950/60 p-6 text-sm text-emerald-50 backdrop-blur-md">
                  <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-300" />
                  <p className="text-base font-bold text-white">¡Solicitud enviada!</p>
                  <p className="mt-2 leading-relaxed text-emerald-50/90">
                    Tu cuenta de entrenador ({email.trim()}) quedó registrada y está esperando la aprobación del administrador.
                    Cuando la acepte, podrás iniciar sesión con tu correo y contraseña.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSolicitudEnviada(false)
                      onLogin()
                    }}
                    className="soft-cta-pill mt-5 w-full rounded-full py-3 text-sm font-extrabold cursor-pointer"
                  >
                    Ir a iniciar sesión
                  </button>
                </div>
              ) : (
              <form onSubmit={enviar} className={isLogin ? 'space-y-4' : 'space-y-3'} noValidate>
                {/* CAMPOS SIGN UP */}
                {!isLogin && (
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-semibold text-sky-100/90 mb-1.5 ml-3"
                    >
                      Nombre completo
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sky-200/70">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        maxLength={80}
                        placeholder="Ej. Camila Mendoza"
                        className="soft-pill-input w-full rounded-full pl-11 pr-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* CORREO */}
                <div>
                  <label
                    htmlFor="authEmail"
                    className="block text-xs font-semibold text-sky-100/90 mb-1.5 ml-3"
                  >
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sky-200/70">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      id="authEmail"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="nadador@correo.com"
                      className="soft-pill-input w-full rounded-full pl-11 pr-4 py-3 text-sm"
                    />
                  </div>
                </div>

                {/* TELÉFONO (opcional, solo al crear la cuenta) */}
                {!isLogin && (
                  <div>
                    <label htmlFor="authPhone" className="block text-xs font-semibold text-sky-100/90 mb-1.5 ml-3">
                      Teléfono <span className="font-normal text-sky-200/70">(opcional)</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sky-200/70">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        id="authPhone"
                        name="phone"
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        autoComplete="tel"
                        placeholder="+57 300 000 0000"
                        className="soft-pill-input w-full rounded-full pl-11 pr-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* CONTRASEÑA */}
                <div>
                  <label
                    htmlFor="authPassword"
                    className="block text-xs font-semibold text-sky-100/90 mb-1.5 ml-3"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sky-200/70">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      id="authPassword"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      minLength={isLogin ? undefined : 8}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      placeholder={isLogin ? 'Ingresa tu contraseña' : 'Mínimo 8 caracteres'}
                      className="soft-pill-input w-full rounded-full pl-11 pr-11 py-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-sky-200/70 hover:text-white cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* CONFIRMAR CONTRASEÑA (SIGN UP) */}
                {!isLogin && (
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-xs font-semibold text-sky-100/90 mb-1.5 ml-3"
                    >
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sky-200/70">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmarContrasena}
                        onChange={(e) => setConfirmarContrasena(e.target.value)}
                        minLength={8}
                        placeholder="Repite tu contraseña"
                        className="soft-pill-input w-full rounded-full pl-11 pr-11 py-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-3.5 flex items-center text-sky-200/70 hover:text-white cursor-pointer"
                        title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* SELECTOR DE ROL (SIGN UP) */}
                {!isLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1.5 ml-3">
                      Soy
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['nadador', 'entrenador'] as const).map((r) => {
                        const active = rol === r
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRol(r)}
                            className={`py-2.5 px-4 rounded-full text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                              active
                                ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-md shadow-sky-400/25'
                                : 'bg-[#0d2847] text-white border-white/20 hover:bg-[#113258]'
                            }`}
                          >
                            <span>{NOMBRE_ROL[r]}</span>
                          </button>
                        )
                      })}
                    </div>
                    {rol === 'entrenador' && (
                      <p className="mt-2 ml-3 text-[11px] leading-snug text-sky-100/75">
                        Las cuentas de entrenador las aprueba el administrador antes de poder ingresar.
                      </p>
                    )}
                  </div>
                )}

                {/* FILA RECORDAR / TÉRMINOS */}
                {isLogin ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 px-1">
                    <label className="inline-flex items-center gap-2 text-xs text-sky-100/85 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={recordar}
                        onChange={(e) => setRecordar(e.target.checked)}
                        className="soft-checkbox"
                      />
                      <span>Recordar sesión</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          'Por favor contacta al administrador o entrenador de SafeSplash para restablecer tu contraseña.'
                        )
                      }
                      className="text-xs font-semibold text-sky-200 hover:text-white underline decoration-sky-300/60 cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 pt-0.5 px-1">
                    <input
                      id="agreeTerms"
                      type="checkbox"
                      checked={terminos}
                      onChange={(e) => setTerminos(e.target.checked)}
                      className="soft-checkbox"
                    />
                    <label
                      htmlFor="agreeTerms"
                      className="text-xs text-sky-100/85 leading-snug cursor-pointer select-none"
                    >
                      Acepto los{' '}
                      <span className="underline decoration-sky-300/70 text-white font-medium">
                        Términos de Servicio
                      </span>{' '}
                      y la{' '}
                      <span className="underline decoration-sky-300/70 text-white font-medium">
                        Política de Privacidad
                      </span>
                    </label>
                  </div>
                )}

                {/* ERRORES */}
                {errores.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-400/40 bg-rose-950/70 p-3.5 text-xs text-rose-200 backdrop-blur-md"
                  >
                    <ul className="space-y-1 list-disc list-inside">
                      {errores.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* BOTÓN CTA PRINCIPAL */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={enviando}
                    className="soft-cta-pill w-full py-3.5 rounded-full text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{enviando ? 'Un momento…' : isLogin ? 'Iniciar sesión' : 'Crear mi cuenta'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
              )}

              {/* ENLACE INFERIOR ALTERNAR LOGIN / REGISTRO */}
              <div className="mt-6 text-center">
                <p className="text-xs text-sky-100/80">
                  <span>{isLogin ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'}</span>
                  <button
                    type="button"
                    onClick={isLogin ? onSignup : onLogin}
                    className="ml-1 font-bold text-white underline decoration-sky-300 hover:text-sky-200 cursor-pointer"
                  >
                    {isLogin ? 'Regístrate aquí' : 'Inicia sesión aquí'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
