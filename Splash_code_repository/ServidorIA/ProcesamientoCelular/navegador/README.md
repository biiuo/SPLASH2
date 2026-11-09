# Prueba del modelo en el celular (Fase 0)

Mide cuántos FPS alcanza `best.pt` corriendo en el navegador del celular.

## 1. Convertir el modelo a ONNX (en Google Colab)

Abrir [exportar_onnx.ipynb](exportar_onnx.ipynb) en Google Colab
(Archivo > Subir cuaderno), subir `best.pt` al panel de archivos (`/content`)
y correr las celdas en orden. Las rutas y tamaños están como variables en la primera celda.

Copiar los `.onnx` descargados a esta carpeta (`ServidorIA/ProcesamientoCelular/navegador/`).
Los `.onnx` están en el `.gitignore`, no se suben a git.

## 2. Servir la página

Con Live Server de VS Code (puerto 5500, que ya tiene regla de firewall), abrir desde el celular:

```
http://192.168.0.35:5500/ServidorIA/ProcesamientoCelular/navegador/index.html
```

(la IP es la de la PC; el celular debe estar en el mismo Wi-Fi y tener internet,
porque la librería `onnxruntime-web` se descarga de un CDN).

## 3. Medir

1. Backend `wasm`, tamaño 640 y 960, con una imagen de la piscina → anotar FPS y detecciones.
2. Backend `webgl` → anotar.
3. Para `webgpu` y multihilo hace falta contexto seguro. En Chrome del celular:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, agregar
   `http://192.168.0.35:5500`, activar y reiniciar Chrome. Probar otra vez.

Anotar los resultados en una tabla (celular, backend, tamaño, ms por frame, FPS).
