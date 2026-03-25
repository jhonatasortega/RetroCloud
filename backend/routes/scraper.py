from flask import Blueprint, request, jsonify
from models import db, Rom
from utils.jwt_helper import admin_required
from utils.thumb_scraper import fetch_thumb, clean_name
import threading, uuid

scraper_bp = Blueprint('scraper', __name__)

# job_id -> { total, done, ok, falhas: [], running: bool }
_jobs = {}


def _get_cfg(app):
    return {k: app.config.get(k, '') for k in
            ['SCREENSCRAPER_USER', 'SCREENSCRAPER_PASS',
             'THEGAMESDB_API_KEY', 'STEAMGRIDDB_API_KEY']}


@scraper_bp.route('/rom/<int:rom_id>/fetch-thumb', methods=['POST'])
@admin_required
def fetch_thumb_route(current_user, rom_id):
    """
    Busca capa para uma ROM.
    Body opcional: { "nome": "nome alternativo para busca" }
    """
    from flask import current_app
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404

    data = request.get_json(silent=True) or {}
    nome_override = data.get('nome')  # nome alternativo enviado pelo usuário

    path = fetch_thumb(rom, current_app.config['UPLOAD_FOLDER'],
                       _get_cfg(current_app), nome_override=nome_override)

    if not path:
        sugestao = clean_name(rom.nome)
        return jsonify({
            'message': f'Capa não encontrada para "{nome_override or rom.nome}".',
            'sugestao': f'Tente um nome mais simples, ex: "{sugestao}"',
            'nome_limpo': sugestao,
        }), 404

    rom.thumb = path
    db.session.commit()
    return jsonify({'message': 'Capa atualizada!', 'thumb': path}), 200


@scraper_bp.route('/roms/fetch-all-thumbs', methods=['POST'])
@admin_required
def fetch_all_thumbs(current_user):
    """Inicia busca de capas em background e retorna job_id para polling."""
    from flask import current_app
    import time

    roms = Rom.query.filter((Rom.thumb == None) | (Rom.thumb == '')).all()
    if not roms:
        return jsonify({'message': 'Todas as ROMs já têm capa!', 'atualizadas': 0, 'job_id': None}), 200

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {'total': len(roms), 'done': 0, 'ok': 0, 'falhas': [], 'running': True}

    cfg        = _get_cfg(current_app)
    upload_folder = current_app.config['UPLOAD_FOLDER']
    flask_app  = current_app._get_current_object()
    rom_ids    = [r.id for r in roms]

    def worker():
        with flask_app.app_context():
            for rom_id in rom_ids:
                rom = Rom.query.get(rom_id)
                if not rom:
                    _jobs[job_id]['done'] += 1
                    continue
                path = fetch_thumb(rom, upload_folder, cfg)
                if path:
                    rom.thumb = path
                    db.session.commit()
                    _jobs[job_id]['ok'] += 1
                else:
                    _jobs[job_id]['falhas'].append(rom.nome)
                _jobs[job_id]['done'] += 1
                time.sleep(0.3)
        _jobs[job_id]['running'] = False

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({'job_id': job_id, 'total': len(roms)}), 202


@scraper_bp.route('/jobs/<job_id>', methods=['GET'])
@admin_required
def job_status(current_user, job_id):
    """Retorna progresso de um job de scraping."""
    job = _jobs.get(job_id)
    if not job:
        return jsonify({'message': 'Job não encontrado'}), 404
    return jsonify(job), 200


@scraper_bp.route('/roms/clear-thumbs', methods=['POST'])
@admin_required
def clear_thumbs(current_user):
    """Apaga thumbs de um sistema (ou todos) para rebuscar."""
    import os
    from flask import current_app
    data    = request.get_json(silent=True) or {}
    sistema = data.get('sistema')  # None = todos

    query = Rom.query
    if sistema:
        query = query.filter_by(sistema=sistema)

    roms = query.filter(Rom.thumb != None).all()
    apagadas = 0

    for rom in roms:
        # Remove arquivo físico
        if rom.thumb:
            path = os.path.join(current_app.root_path, rom.thumb.lstrip('/'))
            for ext in ('.jpg', '.png', '.jpeg', '.webp'):
                stem = os.path.splitext(path)[0]
                f = stem + ext
                if os.path.exists(f):
                    try: os.remove(f)
                    except: pass
        rom.thumb = None
        apagadas += 1

    db.session.commit()
    return jsonify({'message': f'{apagadas} thumbs apagadas', 'apagadas': apagadas}), 200



@admin_required
def scraper_status(current_user):
    """Quais fontes estão ativas."""
    from flask import current_app
    cfg = _get_cfg(current_app)
    return jsonify({
        'archive_org':   True,  # sempre disponível
        'screenscraper': bool(cfg['SCREENSCRAPER_USER']),
        'thegamesdb':    bool(cfg['THEGAMESDB_API_KEY']),
        'steamgriddb':   bool(cfg['STEAMGRIDDB_API_KEY']),
    }), 200