#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        RetroCloud - Iniciando        ║"
echo "╚══════════════════════════════════════╝"
echo ""

if [ ! -f ".env" ]; then
  echo "[!] Arquivo .env não encontrado."
  cp .env.example .env
  echo "    IMPORTANTE: edite o .env e defina uma SECRET_KEY segura antes de usar em produção."
  echo ""
fi

mkdir -p emulatorjs/roms emulatorjs/saves emulatorjs/config emulatorjs/data
mkdir -p backend/static/uploads/thumbs backend/static/uploads/roms

echo "[1/3] Construindo e iniciando containers..."
docker compose up -d --build

echo ""
echo "[2/3] Aguardando backend inicializar..."
sleep 5

echo ""
echo "[3/3] Verificando serviços..."
docker compose ps

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         RetroCloud rodando!          ║"
echo "╠══════════════════════════════════════╣"
echo "║  Frontend : http://localhost         ║"
echo "║  API      : http://localhost/api/    ║"
echo "║                                      ║"
echo "║  Login padrão:                       ║"
echo "║  admin@retrocloud.local / admin      ║"
echo "╚══════════════════════════════════════╝"
echo ""
