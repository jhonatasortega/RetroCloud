# ── Atualização rápida — só copia arquivos e reinicia containers ──
# Use este script para mudanças de código (frontend/backend)
# Use deploy.ps1 apenas quando mudar Dockerfile, package.json ou requirements.txt

$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"
$PROJETO = $PSScriptRoot

Write-Host "`n[RetroCloud] Atualizacao rapida..." -ForegroundColor Cyan

# Copia só o código fonte
Write-Host "[1/2] Copiando arquivos..." -ForegroundColor Yellow
scp -r "$PROJETO/frontend/src"          "${USER}@${HOST_IP}:${DESTINO}/frontend/"
scp -r "$PROJETO/backend/routes"        "${USER}@${HOST_IP}:${DESTINO}/backend/"
scp -r "$PROJETO/backend/utils"         "${USER}@${HOST_IP}:${DESTINO}/backend/"
scp    "$PROJETO/backend/app.py"        "${USER}@${HOST_IP}:${DESTINO}/backend/"
scp    "$PROJETO/backend/models.py"     "${USER}@${HOST_IP}:${DESTINO}/backend/"
scp    "$PROJETO/nginx/nginx.conf"      "${USER}@${HOST_IP}:${DESTINO}/nginx/"
scp    "$PROJETO/docker-compose.yml"    "${USER}@${HOST_IP}:${DESTINO}/"

# Reinicia só os containers afetados
Write-Host "[2/2] Reiniciando containers..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "cd $DESTINO && chmod -R 755 emulatorjs/roms emulatorjs/saves && docker restart retrocloud_frontend retrocloud_backend retrocloud_nginx"

Write-Host "`n[RetroCloud] Atualizado! http://$HOST_IP" -ForegroundColor Green
Write-Host "Aguarde ~5s para o Vite recarregar." -ForegroundColor Gray
