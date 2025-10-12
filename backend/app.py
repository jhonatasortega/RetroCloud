from flask import Flask
from flask_cors import CORS
from models import db
import os

def create_app():
    app = Flask(__name__)
    
    # Configurações
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB para ROMs grandes
    app.config['UPLOAD_FOLDER'] = '/app/static/uploads'
    
    # Inicializar extensões
    CORS(app, resources={r"/*": {"origins": "*"}})
    db.init_app(app)
    
    # Criar diretórios necessários
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'thumbs'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'roms'), exist_ok=True)
    
    # Criar tabelas do banco de dados
    with app.app_context():
        db.create_all()
        
        # Criar configuração padrão do sistema se não existir
        from models import SystemConfig
        if not SystemConfig.query.first():
            config = SystemConfig(
                max_sessions=5,
                session_time_limit=60,
                time_limit_enabled=False
            )
            db.session.add(config)
            db.session.commit()
    
    # Registrar blueprints
    from routes.auth import auth_bp
    from routes.games import games_bp
    from routes.admin import admin_bp
    from routes.system import system_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(games_bp, url_prefix='/api/games')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(system_bp, url_prefix='/api/system')
    
    @app.route('/')
    def index():
        return {'message': 'RetroCloud M5 API', 'status': 'online'}
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)

