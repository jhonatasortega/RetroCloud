$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Atualizando frontend (build)..." -ForegroundColor Cyan

# Copia só o src
scp -r ".\frontend\src"     "${USER}@${HOST_IP}:${DESTINO}/frontend/"
scp    ".\frontend\vite.config.js" "${USER}@${HOST_IP}:${DESTINO}/frontend/"

# Rebuild só o frontend
ssh "${USER}@${HOST_IP}" "cd $DESTINO && docker compose build retrocloud_frontend && docker compose up -d retrocloud_frontend"

Write-Host "`n[RetroCloud] Pronto! http://$HOST_IP" -ForegroundColor Green
