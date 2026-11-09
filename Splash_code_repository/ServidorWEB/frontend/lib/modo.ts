// Dónde se procesa el video de una sesión: en el servidor (ServidorIA/ProcesamientoServidor) o en el celular que
// inicia la sesión (ServidorIA/ProcesamientoCelular, el modelo corre en el navegador). En los dos casos se procesan
// los 3 carriles y se manda lo mismo al backend.
//
// Se elige en Configuración → Procesamiento (se guarda en la base). Si ahí no se eligió, vale PROCESAR_EN del .env
// del backend (servidor por defecto). Al iniciar la sesión, esta función confirma que el dispositivo puede:
//   servidor  siempre en el servidor
//   celular   en el dispositivo que inicia la sesión; si su navegador no puede correr el modelo, en el servidor
// Configuración del modo celular (NEXT_PUBLIC_: se leen al arrancar la web):
//   NEXT_PUBLIC_STREAM_URL  dirección de servidor_stream.py (por defecto ws://<la misma máquina de la web>:8765)
//   NEXT_PUBLIC_MODELO_URL  el modelo ONNX (por defecto /modelo/best_640.onnx, en public/ de la web)
import type { ModoProceso } from './tipos'

export function puedeProcesarAqui(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly === 'object' && typeof WebSocket === 'function' && typeof createImageBitmap === 'function'
}

/** `configurado`: el modo_procesamiento que devuelve GET /api/configuracion. */
export function decidirModo(configurado: ModoProceso): ModoProceso {
  return configurado === 'celular' && puedeProcesarAqui() ? 'celular' : 'servidor'
}

export function urlStream(): string {
  return process.env.NEXT_PUBLIC_STREAM_URL || `ws://${window.location.hostname}:8765`
}

export function urlModelo(): string {
  return process.env.NEXT_PUBLIC_MODELO_URL || '/modelo/best_640.onnx'
}

// Qué sesión procesa ESTE dispositivo (la que inició él). Se recuerda para seguir si se recarga la página; los demás
// dispositivos no la procesan, así las posiciones no llegan repetidas.
const CLAVE = 'safesplash:procesa-sesion'

export function marcarQueProcesoAqui(sesionId: string | null): void {
  try {
    if (sesionId) window.localStorage.setItem(CLAVE, sesionId)
    else window.localStorage.removeItem(CLAVE)
  } catch {
    // sin almacenamiento (modo privado): solo se pierde la reanudación al recargar
  }
}

export function procesoAqui(sesionId: string): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === sesionId
  } catch {
    return false
  }
}
