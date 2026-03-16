from flask import Blueprint, request, jsonify, current_app
from models import db, Rom
from utils.jwt_helper import admin_required
import os
import requests as http_req
import re

scraper_bp = Blueprint('scraper', __name__)

# ── Helpers ──────────────────────────────────────────────────────────────────

def _clean_name(nome):
    """Remove extensão, underscores e prefixos de código de ROM."""
    nome = os.path.splitext(nome)[0]
    nome = re.sub(r'[\(\[\{][^\)\]\}]*[\)\]\}]', '', nome)  # remove (USA), [!], etc
    nome = nome.replace('_', ' ').replace('-', ' ')
    return ' '.join(nome.split()).strip()


def _download(url, path):
    """Baixa arquivo para o disco. Retorna True se OK."""
    try:
        r = http_req.get(url, timeout=15, stream=True,
                         headers={'User-Agent': 'RetroCloud/1.0'})
        r.raise_for_status()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        current_app.logger.warning(f'Download falhou {url}: {e}')
        return False


# ── Fontes de thumbnail ───────────────────────────────────────────────────────

def _try_steamgriddb(nome, sistema, api_key, save_path):
    """Busca no SteamGridDB (requer API key gratuita)."""
    if not api_key:
        return False
    try:
        headers = {'Authorization': f'Bearer {api_key}'}
        r = http_req.get('https://www.steamgriddb.com/api/v2/search/autocomplete',
                         params={'term': nome}, headers=headers, timeout=10)
        r.raise_for_status()
        games = r.json().get('data', [])
        if not games:
            return False
        game_id = games[0]['id']
        r2 = http_req.get(f'https://www.steamgriddb.com/api/v2/grids/game/{game_id}',
                          params={'dimensions': '600x900'}, headers=headers, timeout=10)
        r2.raise_for_status()
        imgs = r2.json().get('data', [])
        if not imgs:
            return False
        return _download(imgs[0]['url'], save_path)
    except Exception as e:
        current_app.logger.warning(f'SteamGridDB falhou "{nome}": {e}')
        return False


def _try_thegamesdb(nome, sistema, api_key, save_path):
    """Busca no TheGamesDB."""
    if not api_key:
        return False
    SYSTEM_IDS = {'ps1': 6, 'psx': 6, 'snes': 6004, 'n64': 3,
                  'gba': 5, 'gbc': 41, 'gb': 4, 'megadrive': 36, 'nes': 7}
    try:
        params = {'apikey': api_key, 'name': nome, 'include': 'boxart'}
        sys_id = SYSTEM_IDS.get(sistema.lower())
        if sys_id:
            params['filter[platform]'] = sys_id
        r = http_req.get('https://api.thegamesdb.net/v1/Games/ByGameName',
                         params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        games = data.get('data', {}).get('games', [])
        if not games:
            return False
        gid = games[0]['id']
        boxart = data.get('include', {}).get('boxart', {})
        base = boxart.get('base_url', {}).get('medium', '')
        images = boxart.get('data', {}).get(str(gid), [])
        for img in images:
            if img.get('side') == 'front':
                return _download(base + img['filename'], save_path)
        if images:
            return _download(base + images[0]['filename'], save_path)
        return False
    except Exception as e:
        current_app.logger.warning(f'TheGamesDB falhou "{nome}": {e}')
        return False


def _try_screenscraper(nome, sistema, user, password, save_path):
    """Busca no ScreenScraper."""
    if not user or not password:
        return False
    SYSTEM_IDS = {'ps1': 57, 'psx': 57, 'snes': 3, 'n64': 14,
                  'gba': 12, 'gbc': 10, 'gb': 9, 'megadrive': 1, 'nes': 3}
    sys_id = SYSTEM_IDS.get(sistema.lower())
    if not sys_id:
        return False
    try:
        params = {'devid': 'retrocloud', 'devpassword': 'retrocloud',
                  'softname': 'retrocloud', 'output': 'json',
                  'ssid': user, 'sspassword': password,
                  'systemeid': sys_id, 'romnom': nome, 'media': 'box-2D'}
        r = http_req.get('https://www.screenscraper.fr/api2/jeuInfos.php',
                         params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        medias = data.get('response', {}).get('jeu', {}).get('medias', [])
        for m in medias:
            if m.get('type') == 'box-2D':
                return _download(m['url'], save_path)
        return False
    except Exception as e:
        current_app.logger.warning(f'ScreenScraper falhou "{nome}": {e}')
        return False


def fetch_thumb_for_rom(rom):
    """Tenta todas as fontes disponíveis. Retorna caminho local ou None."""
    cfg = current_app.config
    upload_folder = cfg['UPLOAD_FOLDER']

    ext = 'jpg'
    save_path = os.path.join(upload_folder, 'thumbs', f'rom_{rom.id}.{ext}')
    thumb_url_path = f'/static/uploads/thumbs/rom_{rom.id}.{ext}'

    nome = _clean_name(rom.nome)
    sistema = rom.sistema or ''

    # Tenta cada fonte em ordem
    sources = [
        lambda: _try_steamgriddb(nome, sistema, cfg.get('STEAMGRIDDB_API_KEY', ''), save_path),
        lambda: _try_thegamesdb(nome, sistema, cfg.get('THEGAMESDB_API_KEY', ''), save_path),
        lambda: _try_screenscraper(nome, sistema, cfg.get('SCREENSCRAPER_USER', ''), cfg.get('SCREENSCRAPER_PASS', ''), save_path),
    ]

    for source in sources:
        if source():
            return thumb_url_path

    return None


# ── Rotas ─────────────────────────────────────────────────────────────────────

@scraper_bp.route('/rom/<int:rom_id>/fetch-thumb', methods=['POST'])
@admin_required
def fetch_thumb(current_user, rom_id):
    """Busca thumbnail para uma ROM específica."""
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404

    cfg = current_app.config
    has_any_key = any([
        cfg.get('STEAMGRIDDB_API_KEY'),
        cfg.get('THEGAMESDB_API_KEY'),
        cfg.get('SCREENSCRAPER_USER'),
    ])

    if not has_any_key:
        return jsonify({
            'message': 'Nenhuma API key configurada.',
            'hint': 'Adicione STEAMGRIDDB_API_KEY no .env (gratuito em steamgriddb.com)',
            'configured': False
        }), 422

    local_path = fetch_thumb_for_rom(rom)
    if not local_path:
        return jsonify({'message': f'Thumbnail não encontrada para "{rom.nome}"'}), 404

    rom.thumb = local_path
    db.session.commit()
    return jsonify({'message': 'Thumbnail atualizada', 'thumb': local_path}), 200


@scraper_bp.route('/roms/fetch-all-thumbs', methods=['POST'])
@admin_required
def fetch_all_thumbs(current_user):
    """Busca thumbnails para todas as ROMs sem capa."""
    cfg = current_app.config
    has_any_key = any([
        cfg.get('STEAMGRIDDB_API_KEY'),
        cfg.get('THEGAMESDB_API_KEY'),
        cfg.get('SCREENSCRAPER_USER'),
    ])

    if not has_any_key:
        return jsonify({
            'message': 'Nenhuma API key configurada.',
            'hint': 'Adicione STEAMGRIDDB_API_KEY no .env (gratuito em steamgriddb.com)',
            'configured': False
        }), 422

    roms = Rom.query.filter((Rom.thumb == None) | (Rom.thumb == '')).all()
    ok, fail = 0, []

    for rom in roms:
        path = fetch_thumb_for_rom(rom)
        if path:
            rom.thumb = path
            ok += 1
        else:
            fail.append(rom.nome)

    db.session.commit()
    return jsonify({
        'atualizadas': ok,
        'falhas': len(fail),
        'detalhes': fail[:20]  # máximo 20 nomes na resposta
    }), 200


@scraper_bp.route('/status', methods=['GET'])
@admin_required
def scraper_status(current_user):
    """Retorna quais fontes estão configuradas."""
    cfg = current_app.config
    return jsonify({
        'steamgriddb': bool(cfg.get('STEAMGRIDDB_API_KEY')),
        'thegamesdb':  bool(cfg.get('THEGAMESDB_API_KEY')),
        'screenscraper': bool(cfg.get('SCREENSCRAPER_USER')),
        'any_configured': any([
            cfg.get('STEAMGRIDDB_API_KEY'),
            cfg.get('THEGAMESDB_API_KEY'),
            cfg.get('SCREENSCRAPER_USER'),
        ])
    }), 200
