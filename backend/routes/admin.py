from flask import Blueprint, request, jsonify, current_app
from models import db, User, Session, Rom, Save, Comment, SystemConfig
from utils.jwt_helper import admin_required
from werkzeug.utils import secure_filename
import os
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

ALLOWED_ROM_EXTENSIONS = {'nes', 'snes', 'smc', 'gba', 'gbc', 'gb', 'n64', 'z64', 'iso', 'bin', 'cue'}
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users(current_user):
    """Lista todos os usuários."""
    users = User.query.all()
    return jsonify({'users': [user.to_dict() for user in users]}), 200


@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user(current_user):
    """Cria um novo usuário (somente admin)."""
    data = request.get_json()
    if not data or not data.get('nome') or not data.get('email') or not data.get('senha'):
        return jsonify({'message': 'Dados incompletos'}), 400

    # Verificar limite de 5 usuários
    if User.query.count() >= 5:
        return jsonify({'message': 'Limite de 5 usuários atingido'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email já cadastrado'}), 400

    import bcrypt
    senha_hash = bcrypt.hashpw(data['senha'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    novo_usuario = User(
        nome=data['nome'],
        email=data['email'],
        senha_hash=senha_hash,
        is_admin=data.get('is_admin', False)
    )
    try:
        db.session.add(novo_usuario)
        db.session.commit()
        return jsonify({'message': 'Usuário criado', 'user': novo_usuario.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao criar usuário', 'error': str(e)}), 500


@admin_bp.route('/shutdown', methods=['POST'])
@admin_required
def shutdown_server(current_user):
    """Desliga o servidor (envia SIGTERM para o processo)."""
    import os, signal
    os.kill(os.getpid(), signal.SIGTERM)
    return jsonify({'message': 'Servidor encerrando...'}), 200

@admin_bp.route('/sessions', methods=['GET'])
@admin_required
def get_active_sessions(current_user):
    """Lista todas as sessões ativas."""
    sessions = Session.query.filter_by(ativo=True).all()
    sessions_data = []
    
    for session in sessions:
        user = User.query.get(session.user_id)
        tempo_sessao = datetime.utcnow() - session.inicio
        sessions_data.append({
            **session.to_dict(),
            'user_nome': user.nome if user else 'Desconhecido',
            'tempo_sessao': str(tempo_sessao).split('.')[0]
        })
    
    return jsonify({'sessions': sessions_data}), 200

@admin_bp.route('/sessions/<int:session_id>/terminate', methods=['POST'])
@admin_required
def terminate_session(current_user, session_id):
    """Encerra uma sessão específica."""
    session = Session.query.get(session_id)
    if not session:
        return jsonify({'message': 'Sessão não encontrada'}), 404
    
    session.ativo = False
    db.session.commit()
    return jsonify({'message': 'Sessão encerrada com sucesso'}), 200

@admin_bp.route('/config', methods=['GET'])
@admin_required
def get_config(current_user):
    """Retorna a configuração do sistema."""
    config = SystemConfig.query.first()
    if not config:
        return jsonify({'message': 'Configuração não encontrada'}), 404
    
    return jsonify({'config': config.to_dict()}), 200

@admin_bp.route('/config', methods=['PUT'])
@admin_required
def update_config(current_user):
    """Atualiza a configuração do sistema."""
    data = request.get_json()
    config = SystemConfig.query.first()
    
    if not config:
        return jsonify({'message': 'Configuração não encontrada'}), 404
    
    if 'max_sessions' in data:
        config.max_sessions = data['max_sessions']
    
    if 'session_time_limit' in data:
        config.session_time_limit = data['session_time_limit']
    
    if 'time_limit_enabled' in data:
        config.time_limit_enabled = data['time_limit_enabled']
    
    try:
        db.session.commit()
        return jsonify({
            'message': 'Configuração atualizada com sucesso',
            'config': config.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao atualizar configuração', 'error': str(e)}), 500

@admin_bp.route('/roms/upload', methods=['POST'])
@admin_required
def upload_rom(current_user):
    """Faz upload de uma nova ROM."""
    # Verificar se os arquivos foram enviados
    if 'rom' not in request.files:
        return jsonify({'message': 'Arquivo ROM não fornecido'}), 400
    
    rom_file = request.files['rom']
    thumb_file = request.files.get('thumb')
    
    if rom_file.filename == '':
        return jsonify({'message': 'Nenhum arquivo selecionado'}), 400
    
    if not allowed_file(rom_file.filename, ALLOWED_ROM_EXTENSIONS):
        return jsonify({'message': 'Tipo de arquivo ROM não permitido'}), 400
    
    # Obter dados do formulário
    nome = request.form.get('nome')
    sistema = request.form.get('sistema')
    descricao = request.form.get('descricao', '')
    tags = request.form.get('tags', '')
    
    if not nome or not sistema:
        return jsonify({'message': 'Nome e sistema são obrigatórios'}), 400
    
    # Salvar ROM
    rom_filename = secure_filename(rom_file.filename)
    rom_dir = os.path.join('/emulatorjs/roms', sistema)
    os.makedirs(rom_dir, exist_ok=True)
    rom_path = os.path.join(rom_dir, rom_filename)
    rom_file.save(rom_path)
    
    # Salvar thumbnail se fornecido
    thumb_path = None
    if thumb_file and allowed_file(thumb_file.filename, ALLOWED_IMAGE_EXTENSIONS):
        thumb_filename = secure_filename(thumb_file.filename)
        thumb_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'thumbs')
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, thumb_filename)
        thumb_file.save(thumb_path)
        thumb_path = f'/static/uploads/thumbs/{thumb_filename}'
    
    # Criar registro no banco
    nova_rom = Rom(
        nome=nome,
        sistema=sistema,
        descricao=descricao,
        caminho=rom_path,
        thumb=thumb_path,
        tags=tags,
        autor_id=current_user.id
    )
    
    try:
        db.session.add(nova_rom)
        db.session.commit()

        # Busca thumbnail automaticamente após cadastro
        try:
            from routes.scraper import auto_fetch_thumb
            local_path = auto_fetch_thumb(nova_rom)
            if local_path:
                nova_rom.thumb = local_path
                db.session.commit()
        except Exception as e:
            current_app.logger.warning(f'Auto-thumb falhou para "{nova_rom.nome}": {e}')

        return jsonify({
            'message': 'ROM enviada com sucesso',
            'rom': nova_rom.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        # Tentar remover arquivos salvos em caso de erro
        if os.path.exists(rom_path):
            os.remove(rom_path)
        if thumb_path and os.path.exists(thumb_path):
            os.remove(thumb_path)
        return jsonify({'message': 'Erro ao salvar ROM', 'error': str(e)}), 500

@admin_bp.route('/roms/<int:rom_id>', methods=['DELETE'])
@admin_required
def delete_rom(current_user, rom_id):
    """Deleta uma ROM."""
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404
    
    # Remover arquivos
    try:
        if os.path.exists(rom.caminho):
            os.remove(rom.caminho)
        if rom.thumb and os.path.exists(rom.thumb):
            os.remove(rom.thumb)
    except Exception as e:
        pass  # Continuar mesmo se não conseguir remover os arquivos
    
    # Remover do banco (cascade vai remover saves e comentários)
    try:
        db.session.delete(rom)
        db.session.commit()
        return jsonify({'message': 'ROM deletada com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao deletar ROM', 'error': str(e)}), 500

@admin_bp.route('/saves', methods=['GET'])
@admin_required
def get_saves(current_user):
    """Lista todos os saves."""
    user_id = request.args.get('user_id', type=int)
    rom_id = request.args.get('rom_id', type=int)
    
    query = Save.query
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    
    if rom_id:
        query = query.filter_by(rom_id=rom_id)
    
    saves = query.all()
    saves_data = []
    
    for save in saves:
        user = User.query.get(save.user_id)
        rom = Rom.query.get(save.rom_id)
        saves_data.append({
            **save.to_dict(),
            'user_nome': user.nome if user else 'Desconhecido',
            'rom_nome': rom.nome if rom else 'Desconhecido'
        })
    
    return jsonify({'saves': saves_data}), 200

@admin_bp.route('/saves/<int:save_id>', methods=['DELETE'])
@admin_required
def delete_save(current_user, save_id):
    """Deleta um save."""
    save = Save.query.get(save_id)
    if not save:
        return jsonify({'message': 'Save não encontrado'}), 404
    
    # Remover arquivo
    try:
        if os.path.exists(save.caminho):
            os.remove(save.caminho)
    except Exception as e:
        pass
    
    try:
        db.session.delete(save)
        db.session.commit()
        return jsonify({'message': 'Save deletado com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao deletar save', 'error': str(e)}), 500

@admin_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@admin_required
def delete_comment(current_user, comment_id):
    """Deleta um comentário."""
    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({'message': 'Comentário não encontrado'}), 404
    
    try:
        db.session.delete(comment)
        db.session.commit()
        return jsonify({'message': 'Comentário deletado com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao deletar comentário', 'error': str(e)}), 500

@admin_bp.route('/restart', methods=['POST'])
@admin_required
def restart_server(current_user):
    """Reinicia o servidor (simulado)."""
    # Em produção, isso poderia executar um comando Docker
    return jsonify({'message': 'Comando de reinicialização enviado'}), 200

