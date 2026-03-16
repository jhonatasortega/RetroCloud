$HOST_IP = "192.168.0.233"
$USER    = "jortega"

Write-Host "`n[RetroCloud] Atualizando..." -ForegroundColor Cyan

# Copia direto para dentro dos containers
Write-Host "[1/2] Copiando arquivos..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "docker cp /home/jortega/retrocloud/frontend/. retrocloud_frontend:/app/ && docker cp /home/jortega/retrocloud/backend/. retrocloud_backend:/app/"

# Reinicia os containers
Write-Host "[2/2] Reiniciando..." -ForegroundColor Yellow
ssh "${USER}@${HOST_IP}" "docker restart retrocloud_frontend retrocloud_backend retrocloud_nginx"

Write-Host "`n[RetroCloud] Pronto! http://$HOST_IP" -ForegroundColor Green
