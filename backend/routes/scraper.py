from flask import Blueprint, request, jsonify
from models import db, Rom
from utils.jwt_helper import admin_required
from utils.thumb_scraper import fetch_thumb, clean_name

scraper_bp = Blueprint('scraper', __name__)


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
    """Busca capas para todas as ROMs sem capa."""
    from flask import current_app
    roms = Rom.query.filter((Rom.thumb == None) | (Rom.thumb == '')).all()
    if not roms:
        return jsonify({'message': 'Todas as ROMs já têm capa!', 'atualizadas': 0}), 200

    cfg = _get_cfg(current_app)
    upload_folder = current_app.config['UPLOAD_FOLDER']
    ok, falhas = 0, []

    for rom in roms:
        import time
        path = fetch_thumb(rom, upload_folder, cfg)
        if path:
            rom.thumb = path
            ok += 1
        else:
            falhas.append(rom.nome)
        time.sleep(0.5)

    db.session.commit()
    return jsonify({'atualizadas': ok, 'falhas': len(falhas), 'detalhes': falhas[:20]}), 200


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
