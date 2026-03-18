from flask import Flask
from flask_cors import CORS
from models import db
import os


def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    if not app.config['SECRET_KEY']:
        raise RuntimeError('SECRET_KEY não definida. Copie .env.example para .env e preencha.')

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    # Otimizações SQLite para Pi 3
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {'check_same_thread': False},
        'pool_pre_ping': True,
    }
    app.config['MAX_CONTENT_LENGTH'] = 600 * 1024 * 1024  # 600 MB para ISOs de PS1
    app.config['UPLOAD_FOLDER'] = '/app/static/uploads'
    app.config['THEGAMESDB_API_KEY']    = os.getenv('THEGAMESDB_API_KEY', '')
    app.config['SCREENSCRAPER_USER']    = os.getenv('SCREENSCRAPER_USER', '')
    app.config['SCREENSCRAPER_PASS']    = os.getenv('SCREENSCRAPER_PASS', '')
    app.config['IGDB_CLIENT_ID']        = os.getenv('IGDB_CLIENT_ID', '')
    app.config['IGDB_CLIENT_SECRET']    = os.getenv('IGDB_CLIENT_SECRET', '')
    app.config['STEAMGRIDDB_API_KEY']   = os.getenv('STEAMGRIDDB_API_KEY', '')
    app.config['EMULATION_MODE'] = os.getenv('EMULATION_MODE', 'local')

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)

    for folder in ['thumbs', 'roms']:
        os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], folder), exist_ok=True)

    with app.app_context():
        db.create_all()
        # WAL mode — muito mais rápido para leituras concorrentes no Pi 3
        try:
            db.engine.execute('PRAGMA journal_mode=WAL')
            db.engine.execute('PRAGMA synchronous=NORMAL')
            db.engine.execute('PRAGMA cache_size=10000')
            db.engine.execute('PRAGMA temp_store=MEMORY')
        except Exception:
            pass  # SQLAlchemy 2.x usa connection diretamente
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text('PRAGMA journal_mode=WAL'))
                conn.execute(db.text('PRAGMA synchronous=NORMAL'))
                conn.execute(db.text('PRAGMA cache_size=10000'))
                conn.execute(db.text('PRAGMA temp_store=MEMORY'))
                conn.commit()
        except Exception:
            pass
        _seed_defaults()

    # ThumbScheduler desativado — busca de capas só via admin manual
    # (scheduler causava travamento do servidor Flask)

    from routes.auth import auth_bp
    from routes.games import games_bp
    from routes.admin import admin_bp
    from routes.system import system_bp
    from routes.scraper import scraper_bp
    from routes.stream import stream_bp

    app.register_blueprint(auth_bp,    url_prefix='/api/auth')
    app.register_blueprint(games_bp,   url_prefix='/api/games')
    app.register_blueprint(admin_bp,   url_prefix='/api/admin')
    app.register_blueprint(system_bp,  url_prefix='/api/system')
    app.register_blueprint(scraper_bp, url_prefix='/api/scraper')
    app.register_blueprint(stream_bp,  url_prefix='/api/stream')

    @app.route('/api/')
    def index():
        return {'message': 'RetroCloud API', 'status': 'online', 'emulation_mode': app.config['EMULATION_MODE']}

    return app


def _seed_defaults():
    """Cria dados iniciais se o banco estiver vazio."""
    from models import SystemConfig, User
    import bcrypt

    if not SystemConfig.query.first():
        db.session.add(SystemConfig(max_sessions=5, session_time_limit=120, time_limit_enabled=False))
        db.session.commit()

    # Cria usuário admin padrão se não houver nenhum admin
    if not User.query.filter_by(is_admin=True).first():
        senha_hash = bcrypt.hashpw(b'admin', bcrypt.gensalt()).decode('utf-8')
        admin = User(nome='Admin', email='admin@retrocloud.local', senha_hash=senha_hash, is_admin=True)
        db.session.add(admin)
        db.session.commit()
        print('[RetroCloud] Usuário admin criado: admin@retrocloud.local / admin')


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_ENV') == 'development')