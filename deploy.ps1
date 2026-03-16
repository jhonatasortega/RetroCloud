# ── Deploy completo — use quando mudar Dockerfile, package.json ou requirements.txt ──
# Para mudanças de código use update.ps1 (muito mais rápido)

$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"
$PROJETO = $PSScriptRoot

Write-Host "`n[RetroCloud] Deploy completo..." -ForegroundColor Cyan

Write-Host "[1/3] Copiando arquivos..." -ForegroundColor Yellow
scp -r "$PROJETO/backend"            "${USER}@${HOST_IP}:${DESTINO}/"
scp -r "$PROJETO/frontend"           "${USER}@${HOST_IP}:${DESTINO}/"
scp -r "$PROJETO/nginx"              "${USER}@${HOST_IP}:${DESTINO}/"
scp    "$PROJETO/docker-compose.yml" "${USER}@${HOST_IP}:${DESTINO}/"
scp    "$PROJETO/start.sh"           "${USER}@${HOST_IP}:${DESTINO}/"
scp    "$PROJETO/.env.example"       "${USER}@${HOST_IP}:${DESTINO}/"

Write-Host "[2/3] Verificando Docker..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "which docker || (curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER)"

Write-Host "[3/3] Rebuild e subindo..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "cd $DESTINO && [ ! -f .env ] && cp .env.example .env; docker compose down && docker compose up -d --build && docker compose ps"

Write-Host "`n[RetroCloud] Deploy concluido! http://$HOST_IP" -ForegroundColor Green
