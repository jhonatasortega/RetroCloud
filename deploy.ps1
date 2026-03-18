$RPI  = "jortega@192.168.0.233"
$DEST = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Deploy completo..." -ForegroundColor Cyan

scp -r ".\frontend2"          "${RPI}:${DEST}/"
scp -r ".\backend"            "${RPI}:${DEST}/"
scp    ".\nginx\nginx.conf"   "${RPI}:${DEST}/nginx/"
scp    ".\docker-compose.yml" "${RPI}:${DEST}/"

ssh $RPI "cd $DEST && chmod -R 755 frontend2 && docker compose down && docker compose up -d --build"

Write-Host "`n[RetroCloud] Pronto! http://192.168.0.233" -ForegroundColor Green
