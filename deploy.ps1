$HOST_IP = "192.168.0.233"
$USER    = "jortega"
$DESTINO = "/home/jortega/retrocloud"
$PROJETO = $PSScriptRoot

Write-Host "`n[1/3] Copiando projeto..." -ForegroundColor Cyan
scp -r "$PROJETO" "${USER}@${HOST_IP}:${DESTINO}"

Write-Host "`n[2/3] Instalando Docker (se necessario)..." -ForegroundColor Cyan
ssh "${USER}@${HOST_IP}" "which docker || (sudo apt-get update -qq && curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ${USER} && sudo apt-get install -y docker-compose-plugin)"

Write-Host "`n[3/3] Subindo RetroCloud..." -ForegroundColor Cyan
ssh "${USER}@${HOST_IP}" "cd ${DESTINO} && chmod +x start.sh && bash start.sh"

Write-Host "`nPronto! http://$HOST_IP" -ForegroundColor Green
Write-Host "Login: admin@retrocloud.local / admin" -ForegroundColor Green
