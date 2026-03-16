#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        RetroCloud - Iniciando        ║"
echo "╚══════════════════════════════════════╝"
echo ""

if [ ! -f ".env" ]; then
  cp .env.example .env
  SECRET=$(openssl rand -hex 32)
  sed -i "s/troque-esta-chave-para-producao-use-python3-secrets-token-hex-32/$SECRET/" .env
  echo "[!] .env criado com SECRET_KEY gerada automaticamente."
fi

# Cria estrutura de pastas
mkdir -p emulatorjs/roms/{ps1,snes,n64,gba,gbc,gb,megadrive,nes}
mkdir -p emulatorjs/saves
mkdir -p backend/static/uploads/{thumbs,roms}

echo "[1/2] Subindo containers..."
docker compose up -d --build

echo ""
echo "[2/2] Aguardando inicialização (10s)..."
sleep 10
docker compose ps

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         RetroCloud rodando!          ║"
echo "╠══════════════════════════════════════╣"
echo "║  Acesse: http://$(hostname -I | awk '{print $1}')"
echo "║  Login:  admin@retrocloud.local      ║"
echo "║  Senha:  admin                       ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "IMPORTANTE: Coloque suas ROMs em:"
echo "  ./emulatorjs/roms/snes/  (SNES)"
echo "  ./emulatorjs/roms/ps1/   (PlayStation 1)"
echo "  ./emulatorjs/roms/n64/   (Nintendo 64)"
echo "  etc."
