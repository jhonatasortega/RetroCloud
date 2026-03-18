$RPI  = "jortega@192.168.0.233"
$DEST = "/home/jortega/retrocloud"

Write-Host "`n[RetroCloud] Atualizando frontend..." -ForegroundColor Cyan

scp -r ".\frontend2"         "${RPI}:${DEST}/"
scp    ".\nginx\nginx.conf"  "${RPI}:${DEST}/nginx/"

ssh $RPI "chmod -R 755 $DEST/frontend2 && docker restart retrocloud_nginx"

Write-Host "`n[RetroCloud] Pronto! http://192.168.0.233" -ForegroundColor Green
