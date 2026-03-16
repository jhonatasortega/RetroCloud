from flask import Blueprint, request, jsonify, current_app
from models import db, Rom
from utils.jwt_helper import admin_required
import os
import requests as http_req

scraper_bp = Blueprint('scraper', __name__)

SYSTEM_MAP_THEGAMESDB = {
    'ps1': 6, 'psx': 6,
    'snes': 6004, 'n64': 3,
    'gba': 5, 'gbc': 41, 'gb': 4,
    'megadrive': 36, 'genesis': 36, 'md': 36,
    'nes': 7,
}

SYSTEM_MAP_SCREENSCRAPER = {
    'ps1': 57, 'psx': 57,
    'snes': 3, 'n64': 14,
    'gba': 12, 'gbc': 10, 'gb': 9,
    'megadrive': 1, 'genesis': 1, 'md': 1,
    'nes': 3,
}

# Nomes de sistema legíveis para busca de imagem
SYSTEM_NAMES = {
    'ps1': 'PlayStation', 'psx': 'PlayStation',
    'snes': 'Super Nintendo', 'n64': 'Nintendo 64',
    'gba': 'Game Boy Advance', 'gbc': 'Game Boy Color', 'gb': 'Game Boy',
    'megadrive': 'Sega Genesis', 'genesis': 'Sega Genesis', 'md': 'Sega Genesis',
    'nes': 'NES',
}


def _normalize(s):
    return s.lower().strip().replace(' ', '').replace('-', '')


def search_thegamesdb(nome, sistema, api_key):
    """Busca via TheGamesDB com API key."""
    sys_id = SYSTEM_MAP_THEGAMESDB.get(_normalize(sistema))
    params = {
        'apikey': api_key,
        'name': nome,
        'fields': 'id,game_title',
        'include': 'boxart',
        'page': 1,
    }
    if sys_id:
        params['filter[platform]'] = sys_id
    try:
        r = http_req.get('https://api.thegamesdb.net/v1/Games/ByGameName', params=params, timeout=10)
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
        current_app.logger.warning(f'TheGamesDB falhou para "{nome}": {e}')
    return None


def search_screenscraper(nome, sistema, user, password):
    """Busca via ScreenScraper."""
    sys_id = SYSTEM_MAP_SCREENSCRAPER.get(_normalize(sistema))
    if not sys_id:
        return None
    params = {
        'devid': 'retrocloud', 'devpassword': 'retrocloud',
        'softname': 'retrocloud', 'output': 'json',
        'ssid': user, 'sspassword': password,
        'systemeid': sys_id, 'romnom': nome, 'media': 'box-2D',
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


def search_igdb(nome, sistema, client_id, client_secret):
    """Busca via IGDB (Twitch API)."""
    try:
        # Obtém token
        token_r = http_req.post('https://id.twitch.tv/oauth2/token', params={
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'client_credentials',
        }, timeout=10)
        token = token_r.json().get('access_token')
        if not token:
            return None

        sys_name = SYSTEM_NAMES.get(_normalize(sistema), '')
        query = f'search "{nome}"; fields name,cover.url; limit 5;'
        r = http_req.post('https://api.igdb.com/v4/games',
            headers={'Client-ID': client_id, 'Authorization': f'Bearer {token}'},
            data=query, timeout=10)
        games = r.json()
        for g in games:
            cover = g.get('cover', {})
            url = cover.get('url', '')
            if url:
                # Troca thumbnail por imagem grande
                return 'https:' + url.replace('t_thumb', 't_cover_big')
    except Exception as e:
        current_app.logger.warning(f'IGDB falhou para "{nome}": {e}')
    return None


def search_steamgriddb(nome, api_key):
    """Busca capa via SteamGridDB (gratuito com key)."""
    try:
        headers = {'Authorization': f'Bearer {api_key}'}
        # Busca o jogo
        r = http_req.get(f'https://www.steamgriddb.com/api/v2/search/autocomplete/{nome}',
                         headers=headers, timeout=10)
        games = r.json().get('data', [])
        if not games:
            return None
        game_id = games[0]['id']
        # Busca as grids (capas verticais)
        r2 = http_req.get(f'https://www.steamgriddb.com/api/v2/grids/game/{game_id}',
                          headers=headers, params={'dimensions': '600x900'}, timeout=10)
        grids = r2.json().get('data', [])
        if grids:
            return grids[0]['url']
    except Exception as e:
        current_app.logger.warning(f'SteamGridDB falhou para "{nome}": {e}')
    return None


def download_thumb(url, rom_id, upload_folder):
    """Faz download da imagem e salva localmente."""
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


def auto_fetch_thumb(rom):
    """
    Tenta buscar thumbnail em todos os provedores disponíveis.
    Retorna o caminho local ou None.
    """
    cfg = current_app.config
    upload_folder = cfg['UPLOAD_FOLDER']
    nome    = rom.nome
    sistema = rom.sistema

    thumb_url = None

    # 1. TheGamesDB (se tiver key)
    if cfg.get('THEGAMESDB_API_KEY'):
        thumb_url = search_thegamesdb(nome, sistema, cfg['THEGAMESDB_API_KEY'])

    # 2. IGDB (se tiver key)
    if not thumb_url and cfg.get('IGDB_CLIENT_ID') and cfg.get('IGDB_CLIENT_SECRET'):
        thumb_url = search_igdb(nome, sistema, cfg['IGDB_CLIENT_ID'], cfg['IGDB_CLIENT_SECRET'])

    # 3. SteamGridDB (se tiver key)
    if not thumb_url and cfg.get('STEAMGRIDDB_API_KEY'):
        thumb_url = search_steamgriddb(nome, cfg['STEAMGRIDDB_API_KEY'])

    # 4. ScreenScraper (se tiver credenciais)
    if not thumb_url and cfg.get('SCREENSCRAPER_USER') and cfg.get('SCREENSCRAPER_PASS'):
        thumb_url = search_screenscraper(nome, sistema, cfg['SCREENSCRAPER_USER'], cfg['SCREENSCRAPER_PASS'])

    if not thumb_url:
        return None

    return download_thumb(thumb_url, rom.id, upload_folder)


@scraper_bp.route('/rom/<int:rom_id>/fetch-thumb', methods=['POST'])
@admin_required
def fetch_thumb(current_user, rom_id):
    """Busca e salva automaticamente a thumbnail de uma ROM."""
    rom = Rom.query.get(rom_id)
    if not rom:
        return jsonify({'message': 'ROM não encontrada'}), 404

    local_path = auto_fetch_thumb(rom)
    if not local_path:
        return jsonify({
            'message': 'Thumbnail não encontrada. Configure ao menos uma API key no .env (THEGAMESDB_API_KEY, IGDB_CLIENT_ID ou STEAMGRIDDB_API_KEY).',
            'hint': 'SteamGridDB é gratuito: https://www.steamgriddb.com/profile/preferences/api'
        }), 404

    rom.thumb = local_path
    db.session.commit()
    return jsonify({'message': 'Thumbnail atualizada', 'thumb': local_path}), 200


@scraper_bp.route('/roms/fetch-all-thumbs', methods=['POST'])
@admin_required
def fetch_all_thumbs(current_user):
    """Busca thumbnails para todas as ROMs sem capa."""
    roms = Rom.query.filter((Rom.thumb == None) | (Rom.thumb == '')).all()
    resultados = {'atualizadas': 0, 'falhas': 0, 'detalhes': []}

    for rom in roms:
        local_path = auto_fetch_thumb(rom)
        if local_path:
            rom.thumb = local_path
            resultados['atualizadas'] += 1
            resultados['detalhes'].append({'rom': rom.nome, 'status': 'ok'})
        else:
            resultados['falhas'] += 1
            resultados['detalhes'].append({'rom': rom.nome, 'status': 'nao_encontrada'})

    db.session.commit()
    return jsonify(resultados), 200
