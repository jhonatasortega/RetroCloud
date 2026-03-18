from flask import Blueprint, request, jsonify
from models import db, User, Session, SystemConfig
from utils.jwt_helper import generate_token
import bcrypt
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    """Altera a senha do usuário autenticado."""
    token = None
    if 'Authorization' in request.headers:
        try: token = request.headers['Authorization'].split(' ')[1]
        except IndexError: return jsonify({'message': 'Token inválido'}), 401
    if not token:
        return jsonify({'message': 'Token não fornecido'}), 401

    from utils.jwt_helper import decode_token
    payload = decode_token(token)
    if not payload:
        return jsonify({'message': 'Token inválido'}), 401

    user = User.query.get(payload['user_id'])
    if not user:
        return jsonify({'message': 'Usuário não encontrado'}), 404

    data = request.get_json()
    if not data or not data.get('senha_atual') or not data.get('senha_nova'):
        return jsonify({'message': 'Dados incompletos'}), 400

    if not bcrypt.checkpw(data['senha_atual'].encode('utf-8'), user.senha_hash.encode('utf-8')):
        return jsonify({'message': 'Senha atual incorreta'}), 401

    user.senha_hash = bcrypt.hashpw(data['senha_nova'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.session.commit()
    return jsonify({'message': 'Senha alterada com sucesso'}), 200
def register():
    """Registra um novo usuário."""
    data = request.get_json()
    
    # Validar dados
    if not data or not data.get('nome') or not data.get('email') or not data.get('senha'):
        return jsonify({'message': 'Dados incompletos'}), 400
    
    # Verificar se o email já existe
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email já cadastrado'}), 400
    
    # Hash da senha
    senha_hash = bcrypt.hashpw(data['senha'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Criar usuário
    novo_usuario = User(
        nome=data['nome'],
        email=data['email'],
        senha_hash=senha_hash,
        is_admin=False
    )
    
    try:
        db.session.add(novo_usuario)
        db.session.commit()
        return jsonify({
            'message': 'Usuário cadastrado com sucesso',
            'user': novo_usuario.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao cadastrar usuário', 'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Autentica um usuário e retorna um token JWT."""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('senha'):
        return jsonify({'message': 'Email e senha são obrigatórios'}), 400
    
    # Buscar usuário
    user = User.query.filter_by(email=data['email']).first()
    if not user:
        return jsonify({'message': 'Credenciais inválidas'}), 401
    
    # Verificar senha
    if not bcrypt.checkpw(data['senha'].encode('utf-8'), user.senha_hash.encode('utf-8')):
        return jsonify({'message': 'Credenciais inválidas'}), 401

    # Limpa sessões expiradas automaticamente
    from datetime import datetime as dt
    Session.query.filter(
        Session.user_id == user.id,
        Session.expiracao < dt.utcnow()
    ).delete()
    db.session.commit()

    # Verifica limite de sessões simultâneas
    config = SystemConfig.query.first()
    if config:
        active_sessions = Session.query.filter_by(user_id=user.id, ativo=True).count()
        if active_sessions >= config.max_sessions:
            # Remove a sessão mais antiga para dar lugar à nova
            oldest = Session.query.filter_by(user_id=user.id, ativo=True)\
                .order_by(Session.expiracao.asc()).first()
            if oldest:
                db.session.delete(oldest)
                db.session.commit()
    
    # Gerar token
    token = generate_token(user.id)
    
    # Calcular expiração
    expiracao = datetime.utcnow() + timedelta(hours=24)
    
    # Criar sessão
    ip_address = request.remote_addr
    nova_sessao = Session(
        user_id=user.id,
        token=token,
        expiracao=expiracao,
        ativo=True,
        ip_address=ip_address
    )
    
    try:
        db.session.add(nova_sessao)
        db.session.commit()
        
        return jsonify({
            'message': 'Login realizado com sucesso',
            'token': token,
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Erro ao criar sessão', 'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Encerra a sessão do usuário."""
    token = None
    
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({'message': 'Token inválido'}), 401
    
    if not token:
        return jsonify({'message': 'Token não fornecido'}), 401
    
    # Buscar sessão
    session = Session.query.filter_by(token=token).first()
    if session:
        session.ativo = False
        db.session.commit()
        return jsonify({'message': 'Logout realizado com sucesso'}), 200
    
    return jsonify({'message': 'Sessão não encontrada'}), 404

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Retorna informações do usuário autenticado."""
    token = None
    
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({'message': 'Token inválido'}), 401
    
    if not token:
        return jsonify({'message': 'Token não fornecido'}), 401
    
    from utils.jwt_helper import decode_token
    payload = decode_token(token)
    if not payload:
        return jsonify({'message': 'Token inválido'}), 401
    
    user = User.query.get(payload['user_id'])
    if not user:
        return jsonify({'message': 'Usuário não encontrado'}), 404
    
    return jsonify({'user': user.to_dict()}), 200