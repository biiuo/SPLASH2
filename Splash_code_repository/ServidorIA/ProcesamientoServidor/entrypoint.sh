#!/bin/sh
# Arma los argumentos del pipeline a partir de variables de entorno (se definen en docker-compose.yml / .env)
set -e

: "${CAMERA_SOURCE:?Definí CAMERA_SOURCE (por ejemplo rtsp://mediamtx:8554/cam)}"
ZONES_FILE="${ZONES_FILE:-/config/zones.json}"

set -- --source "$CAMERA_SOURCE" \
       --weights "${SPLASH_WEIGHTS:-/models/best.pt}" \
       --swimmer-only --letterbox \
       --conf "${CONF:-0.10}" \
       --track-thresh "${TRACK_THRESH:-0.30}" \
       --match-thresh "${MATCH_THRESH:-0.9}" \
       --asso-func "${ASSO_FUNC:-diou}" \
       --contenidas "${CONTENIDAS:-0.8}" \
       --track-buffer-s "${TRACK_BUFFER_S:-4}" \
       --fps-proceso "${FPS_PROCESO:-10}" \
       "$@"

if [ -n "$BACKEND_URL" ]; then
    set -- "$@" --backend-url "$BACKEND_URL" --hz-envio "${HZ_ENVIO:-3}"
fi

if [ -f "$ZONES_FILE" ]; then
    set -- "$@" --zones "$ZONES_FILE"
else
    echo "AVISO: no existe $ZONES_FILE -> sin zonas hasta que empiece una sesion; entonces se usan las de su calibracion (se dibujan en la web, Zonas de analisis)."
fi

exec python pipeline_concurrente.py "$@"
