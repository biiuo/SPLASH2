# ProcesamientoCelular: el modelo corre en el celular

La misma idea que `ProcesamientoServidor/`, pero el modelo corre **en el navegador del celular**. Procesa **los 3
carriles**, con las zonas dibujadas en la web, igual que el servidor. La cámara es la misma de siempre, compartida
por todos, y la interfaz es la página web.

```
cámara ─▶ relé (mediamtx) ─▶ servidor_stream.py ──WebSocket──▶ web en el celular:
                                                                 recorta los 3 carriles → YOLOv5 (ONNX) → un nadador por carril
                                                                 → 3 posiciones por segundo → POST /api/sesiones/{id}/trayectorias
```

El backend recibe **exactamente lo mismo** que de `ProcesamientoServidor`: píxeles de la imagen de la calibración,
carril, identidad y hora de captura. Él pasa a metros, detecta los cruces y reparte por carril.

## Dónde está cada parte

| Parte | Dónde |
|---|---|
| Video al celular | `servidor_stream.py` (aquí). Una sola lectura de la cámara para todos los clientes; siempre manda el frame más reciente con su hora de captura |
| Modelo en el navegador | `ServidorWEB/frontend/lib/celular/` — `ort.ts` (onnxruntime-web), `detector.ts` (recorte + YOLOv5), `carriles.ts` (un nadador por carril, trayectoria), `procesador.ts` (une todo y envía) |
| Pantalla | `ServidorWEB/frontend/components/procesador-celular.tsx`, dentro del cuadro "Sesión de entrenamiento" |
| Quién procesa | `ServidorWEB/frontend/lib/modo.ts`: el dispositivo que **inicia** la sesión. Otro puede tomar el relevo con un botón |
| El servidor no se mete | `ProcesamientoServidor/src/enviador.py` ignora las sesiones de modo `celular` |
| Convertir el modelo | `navegador/exportar_onnx.py` (en esta PC) o `navegador/exportar_onnx.ipynb` (en Colab) |

## Cómo probarlo (sin Docker)

1. **Convertir el modelo a ONNX** (una vez). Desde la raíz del repositorio:
   ```powershell
   .venv\Scripts\python.exe -m pip install onnx==1.19.1
   .venv\Scripts\python.exe ServidorIA\ProcesamientoCelular\navegador\exportar_onnx.py
   ```
   Deja `ServidorWEB/frontend/public/modelo/best_640.onnx` (~28 MB, no se sube a git).

2. **Video para el celular** (otra terminal):
   ```powershell
   .venv\Scripts\python.exe -m pip install -r ServidorIA\ProcesamientoCelular\requirements.txt
   $env:CAMARA_SOURCE = 'ServidorIA\ProcesamientoServidor\src\testing_2min.mp4'   # o rtsp://... de la cámara
   .venv\Scripts\python.exe ServidorIA\ProcesamientoCelular\servidor_stream.py
   ```

3. **La web, abierta a la red** (para que el celular llegue):
   ```powershell
   cd ServidorWEB\frontend
   $env:BACKEND_URL = 'http://127.0.0.1:3001'
   npm run dev -- -H 0.0.0.0
   ```

4. **Elegir el modo celular:** en la web, *Piscina y cámara* → **Procesamiento** → **En el celular** → Guardar.
   También se puede dejar en "Según el archivo .env" y poner `PROCESAR_EN=celular` en el `.env` del backend.

5. Desde el celular (mismo Wi-Fi), abrir `http://IP-DE-LA-PC:3000`, ingresar como entrenador e **iniciar la sesión**.
   Aparece "Procesando en este dispositivo" con la vista de los carriles, los FPS y las posiciones enviadas.
   El firewall de Windows tiene que dejar pasar los puertos **3000** y **8765**.

## Variables

| Variable | Para qué | Por defecto |
|---|---|---|
| `PROCESAR_EN` (backend) | Modo cuando en *Procesamiento* se deja "Según el archivo .env". Lo elegido en la web gana | `servidor` |
| `NEXT_PUBLIC_STREAM_URL` | Dirección de `servidor_stream.py` | `ws://<la misma máquina de la web>:8765` |
| `NEXT_PUBLIC_MODELO_URL` | El modelo ONNX (el número del nombre es el tamaño de entrada) | `/modelo/best_640.onnx` |
| `CAMARA_SOURCE` | Fuente de `servidor_stream.py` | `rtsp://localhost:8554/cam` |
| `STREAM_ANCHO`, `STREAM_FPS`, `STREAM_CALIDAD` | Tamaño, ritmo y calidad JPEG del video enviado | 960 px, 10 fps, 75 |

Las `NEXT_PUBLIC_*` se leen al compilar o arrancar la web: después de cambiarlas, reiniciar `npm run dev`.

## Límites conocidos

- **Probado por partes, no de punta a punta:** el streaming (dos clientes, ~30 ms de retraso), la lógica de carriles y
  trayectoria, y que el servidor ignore las sesiones del celular. Falta probar el modelo corriendo en un celular real.
- **Una persona por carril.** No hay seguimiento tipo ByteTrack: en cada carril se toma la detección más confiable.
- **El modelo corre en el hilo de la página:** mientras procesa, la pantalla puede responder un poco más lento.
- El celular necesita internet la primera vez (onnxruntime-web se baja del CDN).
- `servidor_stream.py` no pide token: cualquiera en la red puede ver el video.
- En Docker, `servidor_stream.py` es el servicio `stream-ws` (`docker compose --profile phone up -d`), y el modelo `.onnx`
  tiene que estar en `ServidorWEB/frontend/public/modelo/` **antes** de construir la imagen de la web.

## Otros archivos

| Archivo | Qué es |
|---|---|
| `navegador/index.html` | Página suelta que mide cuántos FPS logra el modelo en un celular |
| `cliente.html`, `cliente_ia.py` | Pruebas a mano del WebSocket |
| `pruebas_rtsp/` | Pruebas de latencia de la cámara |
