from flask import Blueprint, request, jsonify, send_file
from models import db, Rom, Comment, User, Save
from utils.jwt_helper import token_required
import os

games_bp = Blueprint('games', __name__)

@games_bp.route('/list', methods=['GET'])
@token_required
def list_games(current_user):
    """Lista todas as ROMs disponíveis."""
    sistema = request.args.get('sistema')
    search = request.args.get('search')
    
    query = Rom.query
    
    if sistema:
        query = query.filter_by(sistema=sistema)
    
    if search:
        query = query.filter(Rom.nome.ilike(f'%{search}%'))
    
    roms = query.all()
    return jsonify({'games': [rom.to_dict() for rom in roms]}), 200

@games_bp.route('/<int:rom_id>', methods=['GET'])
@token_required
def get_game(current_user, rom_id):
    """Retorna detalhes de uma ROM específica."""
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404
    
    # Buscar comentários
    comments = Comment.query.filter_by(rom_id=rom_id).all()
    comments_data = []
    for comment in comments:
        user = User.query.get(comment.user_id)
        comments_data.append({
            **comment.to_dict(),
            'user_nome': user.nome if user else 'Desconhecido'
        })
    
    return jsonify({
        'game': rom.to_dict(),
        'comments': comments_data
    }), 200

@games_bp.route('/<int:rom_id>/comment', methods=['POST'])
@token_required
def add_comment(current_user, rom_id):
    """Adiciona um comentário a uma ROM."""
    data = request.get_json()
    
    if not data or not data.get('texto'):
        return jsonify({'message': 'Texto do comentário é obrigatório'}), 400
    
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404
    
    novo_comentario = Comment(
        user_id=current_user.id,
        rom_id=rom_id,
        texto=data['texto']
    )
    
    try:
        db.session.add(novo_comentario)
        db.session.commit()
        return jsonify({
            'message': 'Comentário adicionado com sucesso',
            'comment': novo_comentario.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao adicionar comentário', 'error': str(e)}), 500

@games_bp.route('/systems', methods=['GET'])
@token_required
def get_systems(current_user):
    """Retorna lista de sistemas disponíveis."""
    sistemas = db.session.query(Rom.sistema).distinct().all()
    sistemas_list = [s[0] for s in sistemas]
    return jsonify({'systems': sistemas_list}), 200

@games_bp.route('/<int:rom_id>/play', methods=['GET'])
@token_required
def play_game(current_user, rom_id):
    """Retorna informações para iniciar o jogo."""
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404
    
    # Verificar se existe um save para este usuário e ROM
    save = Save.query.filter_by(user_id=current_user.id, rom_id=rom_id).first()
    
    return jsonify({
        'rom': rom.to_dict(),
        'save_path': save.caminho if save else None,
        'emulator_url': f'/emulator/{rom.sistema}/{os.path.basename(rom.caminho)}'
    }), 200

@games_bp.route('/<int:rom_id>/save', methods=['POST'])
@token_required
def save_game(current_user, rom_id):
    """Salva o progresso do jogo (dados binários base64)."""
    data = request.get_json()

    if not data or not data.get('save_data'):
        return jsonify({'message': 'Dados do save são obrigatórios'}), 400

    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404

    save_dir = f'/emulatorjs/saves/user_{current_user.id}/{rom.sistema}'
    os.makedirs(save_dir, exist_ok=True)

    save_filename = f'{os.path.splitext(os.path.basename(rom.caminho))[0]}.sav'
    save_path = os.path.join(save_dir, save_filename)

    try:
        import base64
        raw = base64.b64decode(data['save_data'])
        with open(save_path, 'wb') as f:
            f.write(raw)

        existing_save = Save.query.filter_by(user_id=current_user.id, rom_id=rom_id).first()
        if existing_save:
            existing_save.caminho = save_path
        else:
            novo_save = Save(user_id=current_user.id, rom_id=rom_id, caminho=save_path)
            db.session.add(novo_save)

        db.session.commit()
        return jsonify({'message': 'Save realizado com sucesso', 'save_path': save_path}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao salvar jogo', 'error': str(e)}), 500


@games_bp.route('/<int:rom_id>/save', methods=['GET'])
@token_required
def load_game(current_user, rom_id):
    """Carrega o save do jogo em base64."""
    import base64
    save = Save.query.filter_by(user_id=current_user.id, rom_id=rom_id).first()
    if not save or not os.path.exists(save.caminho):
        return jsonify({'save_data': None}), 200
    with open(save.caminho, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    return jsonify({'save_data': encoded}), 200

