// onnxruntime-web: corre el modelo ONNX dentro del navegador (WebAssembly, WebGL o WebGPU).
// Se carga desde el CDN cuando hace falta, en vez de empaquetarlo: así la web no pesa más para quien no procesa, y los
// archivos .wasm que necesita se bajan solos del mismo lugar. El celular necesita internet la primera vez.

export const VERSION_ORT = '1.20.1'
const BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${VERSION_ORT}/dist/`

/** Lo poco que usamos de onnxruntime-web. */
export type Tensor = { dims: readonly number[]; data: Float32Array }
export type Sesion = {
  inputNames: readonly string[]
  outputNames: readonly string[]
  run(feeds: Record<string, unknown>): Promise<Record<string, Tensor>>
}
export type Ort = {
  env: { wasm: { wasmPaths: string; numThreads: number } }
  Tensor: new (tipo: 'float32', datos: Float32Array, dims: number[]) => unknown
  InferenceSession: { create(url: string, opciones: { executionProviders: string[] }): Promise<Sesion> }
}

let cargando: Promise<Ort> | null = null

export function cargarOrt(): Promise<Ort> {
  const global = window as unknown as { ort?: Ort }
  if (global.ort) return Promise.resolve(global.ort)
  cargando ??= new Promise<Ort>((resolver, rechazar) => {
    const script = document.createElement('script')
    script.src = `${BASE}ort.all.min.js`
    script.async = true
    script.onload = () => {
      const ort = global.ort
      if (!ort) return rechazar(new Error('onnxruntime-web no se cargó.'))
      ort.env.wasm.wasmPaths = BASE
      // varios hilos solo funcionan con la página "aislada" (cabeceras COOP/COEP); si no, uno
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
      resolver(ort)
    }
    script.onerror = () => {
      cargando = null
      rechazar(new Error('No se pudo bajar onnxruntime-web (¿el celular tiene internet?).'))
    }
    document.head.appendChild(script)
  })
  return cargando
}

/** Crea la sesión del modelo probando primero lo más rápido que tenga el celular. */
export async function crearSesion(ort: Ort, urlModelo: string): Promise<{ sesion: Sesion; backend: string }> {
  const opciones = [...('gpu' in navigator ? ['webgpu'] : []), 'wasm']
  let ultimoError: unknown = null
  for (const backend of opciones) {
    try {
      return { sesion: await ort.InferenceSession.create(urlModelo, { executionProviders: [backend] }), backend }
    } catch (e) {
      ultimoError = e
    }
  }
  const detalle = ultimoError instanceof Error ? ultimoError.message : String(ultimoError)
  throw new Error(`No se pudo cargar el modelo (${urlModelo}): ${detalle}`)
}
