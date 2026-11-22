"""
Convierte best.pt (PyTorch) a ONNX, el formato que el navegador del celular puede correr, y lo deja donde la web lo
sirve: ServidorWEB/frontend/public/modelo/best_640.onnx.

Usa la copia de YOLOv5 que torch.hub ya bajó para el servidor de IA (la misma que carga pipeline_concurrente.py).
Hace falta el paquete onnx:  pip install onnx==1.19.1

Correr desde la raíz del repositorio:
    .venv\\Scripts\\python.exe ServidorIA\\ProcesamientoCelular\\navegador\\exportar_onnx.py
    .venv\\Scripts\\python.exe ServidorIA\\ProcesamientoCelular\\navegador\\exportar_onnx.py --tam 960
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import onnx
import torch

RAIZ = Path(__file__).resolve().parents[3]
PESOS = RAIZ / "ServidorIA" / "ProcesamientoServidor" / "modelo" / "best.pt"
DESTINO = RAIZ / "ServidorWEB" / "frontend" / "public" / "modelo"


def main():
    ap = argparse.ArgumentParser(description="Exporta best.pt a ONNX para el navegador")
    ap.add_argument("--tam", type=int, default=640, help="tamaño de entrada del modelo (640 es más rápido en el celular)")
    ap.add_argument("--opset", type=int, default=12)
    args = ap.parse_args()

    yolov5 = Path(torch.hub.get_dir()) / "ultralytics_yolov5_master"
    if not (yolov5 / "export.py").exists():
        sys.exit(f"No encuentro YOLOv5 en {yolov5}. Corré una vez el servidor de IA (lo baja torch.hub) y volvé a probar.")
    if not PESOS.exists():
        sys.exit(f"No encuentro el modelo en {PESOS}")

    with tempfile.TemporaryDirectory() as tmp:
        pesos = Path(tmp) / "best.pt"
        shutil.copy(PESOS, pesos)
        subprocess.run([sys.executable, "export.py", "--weights", str(pesos), "--include", "onnx",
                        "--imgsz", str(args.tam), "--opset", str(args.opset)], cwd=yolov5, check=True)
        modelo = onnx.load(str(pesos.with_suffix(".onnx")))
        DESTINO.mkdir(parents=True, exist_ok=True)
        salida = DESTINO / f"best_{args.tam}.onnx"
        # todo en un solo archivo: el navegador no puede buscar un .onnx.data aparte
        onnx.save_model(modelo, str(salida), save_as_external_data=False)

    print(f"\nListo: {salida} ({salida.stat().st_size / 1e6:.0f} MB)")
    if args.tam != 640:
        print(f"La web usa best_640.onnx por defecto: para este, NEXT_PUBLIC_MODELO_URL=/modelo/best_{args.tam}.onnx")


if __name__ == "__main__":
    main()
