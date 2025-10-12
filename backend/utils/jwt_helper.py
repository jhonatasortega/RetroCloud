import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from models import Session, User, db

def generate_token(user_id, expires_in_hours=24):
    """Gera um token JWT para o usuário."""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=expires_in_hours),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return token

def decode_token(token):
    """Decodifica um token JWT."""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator para proteger rotas que requerem autenticação."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Verificar se o token está no header Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token inválido'}), 401
        
        if not token:
            return jsonify({'message': 'Token não fornecido'}), 401
        
        # Decodificar o token
        payload = decode_token(token)
        if not payload:
            return jsonify({'message': 'Token inválido ou expirado'}), 401
        
        # Verificar se a sessão está ativa
        session = Session.query.filter_by(token=token, ativo=True).first()
        if not session:
            return jsonify({'message': 'Sessão inválida ou expirada'}), 401
        
        # Verificar se a sessão expirou
        if session.expiracao < datetime.utcnow():
            session.ativo = False
            db.session.commit()
            return jsonify({'message': 'Sessão expirada'}), 401
        
        # Buscar o usuário
        current_user = User.query.get(payload['user_id'])
        if not current_user:
            return jsonify({'message': 'Usuário não encontrado'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator para proteger rotas que requerem privilégios de administrador."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'message': 'Token inválido'}), 401
        
        if not token:
            return jsonify({'message': 'Token não fornecido'}), 401
        
        payload = decode_token(token)
        if not payload:
            return jsonify({'message': 'Token inválido ou expirado'}), 401
        
        session = Session.query.filter_by(token=token, ativo=True).first()
        if not session:
            return jsonify({'message': 'Sessão inválida'}), 401
        
        if session.expiracao < datetime.utcnow():
            session.ativo = False
            db.session.commit()
            return jsonify({'message': 'Sessão expirada'}), 401
        
        current_user = User.query.get(payload['user_id'])
        if not current_user:
            return jsonify({'message': 'Usuário não encontrado'}), 401
        
        if not current_user.is_admin:
            return jsonify({'message': 'Acesso negado: privilégios de administrador necessários'}), 403
        
        return f(current_user, *args, **kwargs)
    
    return decorated

