$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Deploy completo via git pull..." -ForegroundColor Cyan

ssh "${USER}@${HOST_IP}" "cd $DESTINO && git pull origin main && chmod -R 755 emulatorjs/roms emulatorjs/saves && docker compose down && docker compose up -d --build && docker compose ps"

Write-Host "`n[RetroCloud] Deploy concluido! http://$HOST_IP" -ForegroundColor Green
