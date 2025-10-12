from flask import Blueprint, jsonify
from utils.jwt_helper import token_required
from utils.system_info import get_system_info

system_bp = Blueprint('system', __name__)

@system_bp.route('/info', methods=['GET'])
@token_required
def system_info(current_user):
    """Retorna informações do sistema."""
    info = get_system_info()
    return jsonify(info), 200

@system_bp.route('/status', methods=['GET'])
def system_status():
    """Retorna status básico do sistema (sem autenticação)."""
    return jsonify({
        'status': 'online',
        'service': 'RetroCloud M5 API'
    }), 200

