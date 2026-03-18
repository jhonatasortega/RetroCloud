# Deploy completo — rebuild backend
$HOST = "jortega@192.168.0.233"
$DEST = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Deploy completo..." -ForegroundColor Cyan

scp -r ".\frontend2"         "${HOST}:${DEST}/"
scp -r ".\backend"           "${HOST}:${DEST}/"
scp    ".\nginx\nginx.conf"  "${HOST}:${DEST}/nginx/"
scp    ".\docker-compose.yml" "${HOST}:${DEST}/"

ssh $HOST "cd $DEST && docker compose down && docker compose up -d --build"

Write-Host "`n[RetroCloud] Pronto! http://192.168.0.233" -ForegroundColor Green
