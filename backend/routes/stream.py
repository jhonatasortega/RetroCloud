"""
Stub de streaming WebRTC para o RetroCloud.

Estado atual: NOT IMPLEMENTED — retorna 501 com instruções.
Quando implementar: substituir os métodos abaixo pela integração
real com um servidor de streaming (ex: Sunshine, WebRTC, ffmpeg).

Arquitetura prevista:
  Cliente → /api/stream/start → Backend cria sessão de streaming
  Backend → inicia emulador headless no servidor
  Backend → captura vídeo via ffmpeg/libav
  Backend → encode H.264 via WebRTC (aiortc)
  Cliente → recebe stream via RTCPeerConnection
  Cliente → envia inputs de gamepad via WebRTC DataChannel

Dependências necessárias (quando implementar):
  pip install aiortc aiohttp
"""

from flask import Blueprint, jsonify, request
from utils.jwt_helper import token_required

stream_bp = Blueprint('stream', __name__)


@stream_bp.route('/status', methods=['GET'])
def stream_status():
    """Retorna se o modo streaming está disponível."""
    import os
    mode = os.getenv('EMULATION_MODE', 'local')
    return jsonify({
        'mode': mode,
        'streaming_available': False,
        'streaming_reason': 'WebRTC streaming não implementado ainda. Use o modo local (browser).',
        'local_available': True,
    }), 200


@stream_bp.route('/start', methods=['POST'])
@token_required
def start_stream(current_user):
    """[STUB] Inicia uma sessão de streaming."""
    return jsonify({
        'message': 'Streaming via servidor ainda não implementado.',
        'hint': 'Configure EMULATION_MODE=local no .env para usar emulação no browser.',
        'docs': 'https://github.com/jhonatasortega/RetroCloud#streaming',
    }), 501


@stream_bp.route('/stop', methods=['POST'])
@token_required
def stop_stream(current_user):
    """[STUB] Encerra uma sessão de streaming."""
    return jsonify({'message': 'Streaming não implementado'}), 501


@stream_bp.route('/offer', methods=['POST'])
@token_required
def webrtc_offer(current_user):
    """[STUB] Recebe SDP offer do cliente para WebRTC."""
    return jsonify({'message': 'WebRTC não implementado'}), 501
