# Publica la webcam de esta PC en el relé (mediamtx) como si fuera la cámara de la piscina.
#
# Docker en Windows no deja que un contenedor use la webcam, por eso esto corre en Windows y no en el compose.
# El servidor de IA la lee igual que a la cámara real: rtsp://mediamtx:8554/cam.
#
# Uso (en PowerShell, desde esta carpeta):
#   docker compose -f docker-compose.dev.yml up -d mediamtx     # el relé tiene que estar arriba
#   .\webcam.ps1                                                # usa la primera webcam que encuentre
#   .\webcam.ps1 -Camara "HD Webcam"                            # o una en particular
#   .\webcam.ps1 -Listar                                        # ver qué webcams hay
#
# En el .env: CAMERA_RTSP_URL vacía y CAMERA_SOURCE sin definir (no "0").
# Requiere ffmpeg: winget install Gyan.FFmpeg  (después, abrir otra ventana de PowerShell).
# Si Windows no deja correr el script: powershell -ExecutionPolicy Bypass -File .\webcam.ps1

param(
  [string]$Camara = "",
  [string]$Destino = "rtsp://localhost:8554/cam",
  [switch]$Listar
)

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "No encuentro ffmpeg. Instalalo con: winget install Gyan.FFmpeg (y abrí otra ventana de PowerShell)." -ForegroundColor Red
  exit 1
}

# ffmpeg escribe la lista de dispositivos en stderr, con líneas como:  [dshow @ ...] "Integrated Camera" (video)
$salida = & ffmpeg -hide_banner -list_devices true -f dshow -i dummy 2>&1 | Out-String
$camaras = [regex]::Matches($salida, '"([^"]+)"\s+\(video\)') | ForEach-Object { $_.Groups[1].Value }

if ($Listar) {
  if ($camaras) { $camaras | ForEach-Object { Write-Host "  $_" } } else { Write-Host "No encontré webcams." }
  exit 0
}

if (-not $Camara) {
  if (-not $camaras) {
    Write-Host "No encontré ninguna webcam. Revisá que esté conectada y que ninguna otra app (Teams, Zoom...) la esté usando." -ForegroundColor Red
    exit 1
  }
  $Camara = @($camaras)[0]
}

Write-Host "Webcam: $Camara"
Write-Host "Publicando en $Destino  (Ctrl+C para cortar)"
Write-Host "Para verla: VLC -> Medio -> Abrir ubicación de red -> $Destino"

# libx264 ultrafast/zerolatency: lo mismo que usa la cámara simulada del compose.
# yuv420p: muchas webcams entregan otro formato que algunos lectores RTSP no abren.
& ffmpeg -hide_banner -loglevel warning `
  -f dshow -rtbufsize 100M -i "video=$Camara" `
  -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 30 `
  -f rtsp -rtsp_transport tcp $Destino
