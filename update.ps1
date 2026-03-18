# Atualização rápida — copia frontend e reinicia nginx
$HOST = "jortega@192.168.0.233"
$DEST = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Atualizando..." -ForegroundColor Cyan

scp -r ".\frontend2" "${HOST}:${DEST}/"
scp    ".\nginx\nginx.conf" "${HOST}:${DEST}/nginx/"

ssh $HOST "docker restart retrocloud_nginx"

Write-Host "`n[RetroCloud] Pronto! http://192.168.0.233" -ForegroundColor Green
