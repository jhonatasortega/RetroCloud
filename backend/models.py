from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    sessions = db.relationship('Session', backref='user', lazy=True, cascade='all, delete-orphan')
    saves = db.relationship('Save', backref='user', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'email': self.email,
            'is_admin': self.is_admin,
            'criado_em': self.criado_em.isoformat()
        }

class Rom(db.Model):
    __tablename__ = 'roms'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(200), nullable=False)
    sistema = db.Column(db.String(50), nullable=False)
    descricao = db.Column(db.Text)
    caminho = db.Column(db.String(500), nullable=False)
    thumb = db.Column(db.String(500))
    tags = db.Column(db.String(200))
    autor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    data_upload = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    saves = db.relationship('Save', backref='rom', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='rom', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        # Resolve extensão correta da thumb (suporta .jpg e .png)
        thumb = self.thumb
        if thumb:
            import os
            base_path = thumb.replace('/static/', '', 1)
            static_dir = os.path.join(os.path.dirname(__file__), 'static')
            full = os.path.join(static_dir, base_path)
            if not os.path.exists(full):
                # Tenta extensão alternativa
                stem = os.path.splitext(full)[0]
                for ext in ('.jpg', '.png', '.jpeg', '.webp'):
                    alt = stem + ext
                    if os.path.exists(alt):
                        thumb = '/static/' + os.path.splitext(base_path)[0] + ext
                        break
                else:
                    thumb = None  # arquivo não existe
        return {
            'id': self.id,
            'nome': self.nome,
            'sistema': self.sistema,
            'descricao': self.descricao,
            'caminho': self.caminho,
            'thumb': thumb,
            'tags': self.tags,
            'autor_id': self.autor_id,
            'data_upload': self.data_upload.isoformat()
        }

class Save(db.Model):
    __tablename__ = 'saves'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rom_id = db.Column(db.Integer, db.ForeignKey('roms.id'), nullable=False)
    caminho = db.Column(db.String(500), nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'rom_id': self.rom_id,
            'caminho': self.caminho,
            'criado_em': self.criado_em.isoformat()
        }

class Session(db.Model):
    __tablename__ = 'sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(500), nullable=False, unique=True)
    inicio = db.Column(db.DateTime, default=datetime.utcnow)
    expiracao = db.Column(db.DateTime, nullable=False)
    ativo = db.Column(db.Boolean, default=True)
    ip_address = db.Column(db.String(50))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'inicio': self.inicio.isoformat(),
            'expiracao': self.expiracao.isoformat(),
            'ativo': self.ativo,
            'ip_address': self.ip_address
        }

class Comment(db.Model):
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rom_id = db.Column(db.Integer, db.ForeignKey('roms.id'), nullable=False)
    texto = db.Column(db.Text, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'rom_id': self.rom_id,
            'texto': self.texto,
            'criado_em': self.criado_em.isoformat()
        }

class NetplaySession(db.Model):
    __tablename__ = 'netplay_sessions'

    id = db.Column(db.Integer, primary_key=True)
    host_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rom_id = db.Column(db.Integer, db.ForeignKey('roms.id'), nullable=False)
    room_id = db.Column(db.String(20), nullable=False, unique=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    host = db.relationship('User', foreign_keys=[host_user_id])
    rom = db.relationship('Rom', foreign_keys=[rom_id])

    def to_dict(self):
        return {
            'id': self.id,
            'host_user_id': self.host_user_id,
            'host_nome': self.host.nome if self.host else None,
            'rom_id': self.rom_id,
            'room_id': self.room_id,
            'criado_em': self.criado_em.isoformat(),
        }

class SystemConfig(db.Model):
    __tablename__ = 'system_config'
    
    id = db.Column(db.Integer, primary_key=True)
    max_sessions = db.Column(db.Integer, default=5)
    session_time_limit = db.Column(db.Integer)  # em minutos
    time_limit_enabled = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'max_sessions': self.max_sessions,
            'session_time_limit': self.session_time_limit,
            'time_limit_enabled': self.time_limit_enabled
        }

