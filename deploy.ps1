$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Deploy completo (build de producao)..." -ForegroundColor Cyan

# Copia arquivos
Write-Host "[1/3] Copiando arquivos..." -ForegroundColor Yellow
scp -r ".\frontend" "${USER}@${HOST_IP}:${DESTINO}/"
scp -r ".\backend"  "${USER}@${HOST_IP}:${DESTINO}/"
scp    ".\docker-compose.yml" "${USER}@${HOST_IP}:${DESTINO}/"
scp    ".\nginx\nginx.conf"   "${USER}@${HOST_IP}:${DESTINO}/nginx/"

# Rebuild com build de producao
Write-Host "[2/3] Build de producao (pode demorar ~3min)..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "cd $DESTINO && chmod -R 755 emulatorjs/ && docker compose down && docker compose up -d --build"

Write-Host "[3/3] Aguardando..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
ssh "${USER}@${HOST_IP}" "docker compose ps"

Write-Host "`n[RetroCloud] Pronto! http://$HOST_IP" -ForegroundColor Green
