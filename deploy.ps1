$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"
$PROJETO = $PSScriptRoot

Write-Host "`n╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       RetroCloud — Deploy            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝`n" -ForegroundColor Cyan

# 1. Copia arquivos (exclui node_modules, .git, db local)
Write-Host "[1/3] Copiando arquivos..." -ForegroundColor Yellow
scp -r -q `
  "$PROJETO/backend"        "${USER}@${HOST_IP}:${DESTINO}/" `
  "$PROJETO/frontend"       "${USER}@${HOST_IP}:${DESTINO}/" `
  "$PROJETO/nginx"          "${USER}@${HOST_IP}:${DESTINO}/" `
  "$PROJETO/docker-compose.yml" "${USER}@${HOST_IP}:${DESTINO}/" `
  "$PROJETO/start.sh"       "${USER}@${HOST_IP}:${DESTINO}/" `
  "$PROJETO/.env.example"   "${USER}@${HOST_IP}:${DESTINO}/"

# 2. Garante Docker instalado
Write-Host "[2/3] Verificando Docker..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" @"
which docker > /dev/null 2>&1 || (
  echo 'Instalando Docker...'
  sudo apt-get update -qq
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  sudo apt-get install -y docker-compose-plugin
)
"@

# 3. Reinicia containers
Write-Host "[3/3] Reiniciando containers..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" @"
cd ${DESTINO}
chmod +x start.sh

# Cria .env se nao existir
if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=\$(openssl rand -hex 32)
  sed -i "s/troque-esta-chave-para-producao-use-python3-secrets-token-hex-32/\$SECRET/" .env
  echo '.env criado com SECRET_KEY gerada automaticamente.'
fi

# Para, reconstroi e sobe
docker compose down
docker compose up -d --build
echo 'Aguardando servicos...'
sleep 5
docker compose ps
"@

Write-Host "`n╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Deploy concluido!                   ║" -ForegroundColor Green
Write-Host "║  http://$HOST_IP" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝`n" -ForegroundColor Green
