$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"
$PROJETO = $PSScriptRoot

Write-Host "`n[RetroCloud] Iniciando deploy..." -ForegroundColor Cyan

# 1. Copia arquivos
Write-Host "[1/3] Copiando arquivos..." -ForegroundColor Yellow
scp -r "$PROJETO/backend"             "${USER}@${HOST_IP}:${DESTINO}/"
scp -r "$PROJETO/frontend"            "${USER}@${HOST_IP}:${DESTINO}/"
scp -r "$PROJETO/nginx"               "${USER}@${HOST_IP}:${DESTINO}/"
scp    "$PROJETO/docker-compose.yml"  "${USER}@${HOST_IP}:${DESTINO}/"
scp    "$PROJETO/start.sh"            "${USER}@${HOST_IP}:${DESTINO}/"
scp    "$PROJETO/.env.example"        "${USER}@${HOST_IP}:${DESTINO}/"

# 2. Instala Docker se necessario
Write-Host "[2/3] Verificando Docker..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "which docker || curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER && sudo apt-get install -y docker-compose-plugin"

# 3. Reinicia containers
Write-Host "[3/3] Reiniciando containers..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "cd $DESTINO && chmod +x start.sh && [ ! -f .env ] && cp .env.example .env && SECRET=\$(openssl rand -hex 32) && sed -i s/troque-esta-chave-para-producao-use-python3-secrets-token-hex-32/\$SECRET/ .env; docker compose down && docker compose up -d --build && docker compose ps"

Write-Host "`n[RetroCloud] Deploy concluido! Acesse: http://$HOST_IP" -ForegroundColor Green
