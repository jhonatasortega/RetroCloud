from flask import Blueprint, request, jsonify, current_app
from models import db, Rom
from utils.jwt_helper import admin_required
import os
import requests as http_req

scraper_bp = Blueprint('scraper', __name__)

THEGAMESDB_BASE = 'https://api.thegamesdb.net/v1'

SYSTEM_MAP_THEGAMESDB = {
    'ps1':        6,
    'psx':        6,
    'snes':       6004,
    'n64':        3,
    'gba':        5,
    'gbc':        41,
    'gb':         4,
    'megadrive':  36,
    'genesis':    36,
    'md':         36,
    'nes':        7,
    'nds':        8,
    'gba':        5,
}

SYSTEM_MAP_SCREENSCRAPER = {
    'ps1':       57,
    'psx':       57,
    'snes':      3,
    'n64':       14,
    'gba':       12,
    'gbc':       10,
    'gb':        9,
    'megadrive': 1,
    'genesis':   1,
    'md':        1,
    'nes':       3,
}


def _normalize_system(sistema: str) -> str:
    return sistema.lower().strip().replace(' ', '').replace('-', '')


def search_thegamesdb(nome: str, sistema: str, api_key: str):
    """Busca thumbnail via TheGamesDB. Retorna URL da imagem ou None."""
    sys_id = SYSTEM_MAP_THEGAMESDB.get(_normalize_system(sistema))
    params = {
        'apikey': api_key,
        'name': nome,
        'fields': 'id,game_title,platform',
        'include': 'boxart',
        'page': 1,
    }
    if sys_id:
        params['filter[platform]'] = sys_id

    try:
        r = http_req.get(f'{THEGAMESDB_BASE}/Games/ByGameName', params=params, timeout=10)
        r.raise_for_status()
        data = r.json()

        games = data.get('data', {}).get('games', [])
        if not games:
            return None

        game_id = games[0]['id']
        boxart = data.get('include', {}).get('boxart', {})
        base_url = boxart.get('base_url', {}).get('medium', '')
        images = boxart.get('data', {}).get(str(game_id), [])

        for img in images:
            if img.get('side') == 'front':
                return base_url + img['filename']

        if images:
            return base_url + images[0]['filename']

    except Exception as e:
        current_app.logger.warning(f'TheGamesDB scraping falhou para "{nome}": {e}')

    return None


def search_screenscraper(nome: str, sistema: str, user: str, password: str):
    """Busca thumbnail via ScreenScraper como fallback."""
    sys_id = SYSTEM_MAP_SCREENSCRAPER.get(_normalize_system(sistema))
    if not sys_id:
        return None

    params = {
        'devid': 'retrocloud',
        'devpassword': 'retrocloud',
        'softname': 'retrocloud',
        'output': 'json',
        'ssid': user,
        'sspassword': password,
        'systemeid': sys_id,
        'romnom': nome,
        'media': 'box-2D',
    }

    try:
        r = http_req.get('https://www.screenscraper.fr/api2/jeuInfos.php', params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        medias = data.get('response', {}).get('jeu', {}).get('medias', [])
        for m in medias:
            if m.get('type') == 'box-2D':
                return m.get('url')
    except Exception as e:
        current_app.logger.warning(f'ScreenScraper falhou para "{nome}": {e}')

    return None


def download_thumb(url: str, rom_id: int, upload_folder: str) -> str | None:
    """Faz download da imagem e salva localmente. Retorna caminho relativo."""
    try:
        r = http_req.get(url, timeout=15, stream=True)
        r.raise_for_status()

        ext = url.split('.')[-1].split('?')[0].lower()
        if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
            ext = 'jpg'

        thumb_dir = os.path.join(upload_folder, 'thumbs')
        os.makedirs(thumb_dir, exist_ok=True)
        filename = f'rom_{rom_id}.{ext}'
        full_path = os.path.join(thumb_dir, filename)

        with open(full_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        return f'/static/uploads/thumbs/{filename}'
    except Exception as e:
        current_app.logger.warning(f'Download de thumb falhou ({url}): {e}')
        return None


@scraper_bp.route('/rom/<int:rom_id>/fetch-thumb', methods=['POST'])
@admin_required
def fetch_thumb(current_user, rom_id):
    """Busca e salva automaticamente a thumbnail de uma ROM."""
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404

    api_key = current_app.config.get('THEGAMESDB_API_KEY', '')
    ss_user = current_app.config.get('SCREENSCRAPER_USER', '')
    ss_pass = current_app.config.get('SCREENSCRAPER_PASS', '')
    upload_folder = current_app.config['UPLOAD_FOLDER']

    thumb_url = None

    if api_key:
        thumb_url = search_thegamesdb(rom.nome, rom.sistema, api_key)

    if not thumb_url and ss_user and ss_pass:
        thumb_url = search_screenscraper(rom.nome, rom.sistema, ss_user, ss_pass)

    if not thumb_url:
        return jsonify({'message': 'Thumbnail não encontrada nos repositórios'}), 404

    local_path = download_thumb(thumb_url, rom_id, upload_folder)
    if not local_path:
        return jsonify({'message': 'Erro ao baixar thumbnail'}), 500

    rom.thumb = local_path
    db.session.commit()

    return jsonify({'message': 'Thumbnail atualizada', 'thumb': local_path}), 200


@scraper_bp.route('/roms/fetch-all-thumbs', methods=['POST'])
@admin_required
def fetch_all_thumbs(current_user):
    """Busca thumbnails para todas as ROMs que não têm capa."""
    roms_sem_thumb = Rom.query.filter(
        (Rom.thumb == None) | (Rom.thumb == '')
    ).all()

    resultados = {'atualizadas': 0, 'falhas': 0, 'detalhes': []}

    api_key = current_app.config.get('THEGAMESDB_API_KEY', '')
    ss_user = current_app.config.get('SCREENSCRAPER_USER', '')
    ss_pass = current_app.config.get('SCREENSCRAPER_PASS', '')
    upload_folder = current_app.config['UPLOAD_FOLDER']

    for rom in roms_sem_thumb:
        thumb_url = None

        if api_key:
            thumb_url = search_thegamesdb(rom.nome, rom.sistema, api_key)

        if not thumb_url and ss_user and ss_pass:
            thumb_url = search_screenscraper(rom.nome, rom.sistema, ss_user, ss_pass)

        if thumb_url:
            local_path = download_thumb(thumb_url, rom.id, upload_folder)
            if local_path:
                rom.thumb = local_path
                resultados['atualizadas'] += 1
                resultados['detalhes'].append({'rom': rom.nome, 'status': 'ok'})
                continue

        resultados['falhas'] += 1
        resultados['detalhes'].append({'rom': rom.nome, 'status': 'nao_encontrada'})

    db.session.commit()
    return jsonify(resultados), 200
