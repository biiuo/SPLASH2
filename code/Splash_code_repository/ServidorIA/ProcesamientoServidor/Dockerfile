# Servidor de IA (variante B): detección YOLOv5 + ByteTrack + identidades estables.
# Corre en CPU. Para GPU NVIDIA, cambiá la imagen base y el índice de torch (ver docs/Docker.md).

FROM python:3.11-slim

# Conexión lenta o que se corta: PIP_DEFAULT_TIMEOUT y PIP_RETRIES hacen que pip espere más y reintente si la conexión
# falla. PIP_RESUME_RETRIES (pip >= 25.2) cubre el caso más traicionero: la descarga se corta "en silencio" a mitad
# de un archivo grande; pip lo nota y la RETOMA desde donde quedó, en vez de seguir de largo y fallar al final con
# "THESE PACKAGES DO NOT MATCH THE HASHES".
ENV PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PIP_RESUME_RETRIES=10 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TORCH_HOME=/cache/torch

# libgl1 y libglib2.0-0: los pide OpenCV. git: lo usan torch.hub y gitpython.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Primero solo los requisitos: si no cambian, Docker reutiliza esta capa (que es la lenta).
COPY requirements.txt .
# La caché de pip vive FUERA de la imagen (no la agranda) y se conserva entre construcciones: si una falla a mitad de
# camino, la siguiente no vuelve a bajar lo que ya tenía (torch solo son ~210 MB).
# Primero se actualiza pip: el de la imagen (24.0) no sabe retomar descargas cortadas.
RUN --mount=type=cache,id=pip-ia,target=/root/.cache/pip \
    pip install "pip>=25.2" \
    && pip install -r requirements.txt

COPY src ./src
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app/src
ENTRYPOINT ["/entrypoint.sh"]
