// Reenvía todo lo que llega a /api/... al backend. El navegador habla siempre con la web y no sabe dónde vive el
// backend; así no hay problemas de CORS.
// La dirección del backend se lee de BACKEND_URL en cada pedido (se puede cambiar sin recompilar).
//
// Sesión: al registrarse o ingresar, el backend devuelve un token. Acá se guarda en una cookie httpOnly (el JavaScript
// de la página no la puede leer, así un script inyectado no puede robarla) y no se le pasa al navegador. En cada pedido
// siguiente la cookie se convierte en `Authorization: Bearer ...` hacia el backend. /api/auth/salir borra la cookie.
//
// Avisos en vivo (SSE, `text/event-stream`): la respuesta se pasa tal cual, a medida que llega, sin juntarla. Si el
// navegador cierra la conexión, se corta también la del backend (signal).

export const dynamic = 'force-dynamic'

const backend = () => process.env.BACKEND_URL ?? 'http://localhost:3001'

const COOKIE = 'ss_sesion'
/** Igual que la duración del token en el backend (12 h). */
const DURACION_S = 12 * 60 * 60

function leerCookie(req: Request, nombre: string): string | null {
  for (const parte of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nombre) return decodeURIComponent(v.join('='))
  }
  return null
}

function cookieDeSesion(req: Request, valor: string, maxAge: number): string {
  // Secure solo si la web se sirve por https (en la red local de la piscina suele ser http)
  const segura = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'
  return `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${segura ? '; Secure' : ''}`
}

async function reenviar(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await params
  const camino = ruta.join('/')

  if (camino === 'auth/salir') {
    return new Response(null, { status: 204, headers: { 'Set-Cookie': cookieDeSesion(req, '', 0) } })
  }

  const destino = `${backend()}/api/${camino}${new URL(req.url).search}`
  const cabeceras = new Headers()
  const tipo = req.headers.get('content-type')
  if (tipo) cabeceras.set('content-type', tipo)
  const token = leerCookie(req, COOKIE)
  const autorizacion = req.headers.get('authorization') ?? (token ? `Bearer ${token}` : null)
  if (autorizacion) cabeceras.set('authorization', autorizacion)

  let r: Response
  try {
    r = await fetch(destino, {
      method: req.method,
      headers: cabeceras,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
      cache: 'no-store',
      signal: req.signal,
    })
  } catch {
    return Response.json({ error: 'backend_no_disponible' }, { status: 502 })
  }

  if (r.ok && r.body && (r.headers.get('content-type') ?? '').startsWith('text/event-stream')) {
    return new Response(r.body, {
      status: r.status,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        // no-transform: que nadie lo comprima ni lo junte en el camino (llegaría todo junto, tarde)
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // binarios (la imagen de una calibración): se pasan tal cual; leerlos como texto los rompería
  const tipoRespuesta = r.headers.get('content-type') ?? ''
  if (r.ok && /^(image|application\/octet-stream)/.test(tipoRespuesta)) {
    return new Response(await r.arrayBuffer(), {
      status: r.status,
      headers: { 'Content-Type': tipoRespuesta, 'Cache-Control': r.headers.get('cache-control') ?? 'no-store' },
    })
  }

  const texto = await r.text()
  const respuesta = { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' } }

  // al ingresar o registrarse, el token queda en la cookie y al navegador solo le llega el usuario
  if (r.ok && (camino === 'auth/ingresar' || camino === 'auth/registro')) {
    try {
      const { token: nuevo, usuario } = JSON.parse(texto) as { token: string; usuario: unknown }
      return new Response(JSON.stringify({ usuario }), {
        ...respuesta,
        headers: { ...respuesta.headers, 'Set-Cookie': cookieDeSesion(req, nuevo, DURACION_S) },
      })
    } catch {
      return Response.json({ error: 'respuesta_invalida' }, { status: 502 })
    }
  }
  // la sesión venció: se borra la cookie para no seguir mandándola
  if (r.status === 401 && token) {
    return new Response(texto, { ...respuesta, headers: { ...respuesta.headers, 'Set-Cookie': cookieDeSesion(req, '', 0) } })
  }
  return new Response(texto, respuesta)
}

export const GET = reenviar
export const POST = reenviar
export const PUT = reenviar
export const PATCH = reenviar
export const DELETE = reenviar
