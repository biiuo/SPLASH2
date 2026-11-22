export * from '@/domain/zonas/zonas'

/** La imagen de un canvas como JPEG en base64 (lo que guarda el backend con la calibración). */
export function aJpeg(c: HTMLCanvasElement, calidad = 0.88): string {
  return c.toDataURL('image/jpeg', calidad)
}
