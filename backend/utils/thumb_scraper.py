"""
Scraper de capas do RetroCloud.
Fonte primária: Internet Archive (gratuito, sem conta, sem API key).
Fontes opcionais: ScreenScraper, TheGamesDB, SteamGridDB (se configuradas no .env).

Fluxo:
  1. Ao cadastrar ROM → busca em background automaticamente
  2. Diariamente → varre ROMs sem capa e tenta novamente
  3. Manual → admin pode tentar com nome alternativo
"""

import os, re, time, logging, threading
import requests

log = logging.getLogger('thumb_scraper')

ARCHIVE_COLLECTIONS = {
    'snes':      'coversdb-snes',
    'n64':       'coversdb-n64',
    'ps1':       'coversdb-psx',
    'psx':       'coversdb-psx',
    'megadrive': 'coversdb-genesis',
    'genesis':   'coversdb-genesis',
    'md':        'coversdb-genesis',
    'gba':       'coversdb-gba',
    'gbc':       'coversdb-gbc',
    'gb':        'coversdb-gb',
    'nes':       'coversdb-nes',
}


def clean_name(nome):
    """Remove extensão, prefixos de sistema, códigos de região e caracteres extras."""
    nome = os.path.splitext(nome)[0]
    nome = re.sub(r'^[a-z]{2,5}_', '', nome)              # remove snes_, ps1_, etc
    nome = re.sub(r'[\(\[\{][^\)\]\}]*[\)\]\}]', '', nome) # remove (USA), [!], etc
    nome = re.sub(r'[_\-]+', ' ', nome)
    nome = re.sub(r'\s+', ' ', nome)
    return nome.strip()


def _download(url, save_path):
    try:
        r = requests.get(url, timeout=20, stream=True,
                         headers={'User-Agent': 'RetroCloud/1.0'})
        r.raise_for_status()
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, 'wb') as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        log.debug(f'Download falhou {url}: {e}')
        return False


def _archive_org(nome_busca, sistema, save_path):
    """Internet Archive — gratuito, sem API key."""
    collection = ARCHIVE_COLLECTIONS.get(sistema.lower(), '')
    queries = []
    if collection:
        queries.append(f'collection:{collection} AND title:"{nome_busca}"')
    queries.append(f'title:"{nome_busca}" AND (subject:"box art" OR subject:"covers") AND mediatype:image')

    for query in queries:
        try:
            r = requests.get(
                'https://archive.org/advancedsearch.php',
                params={'q': query, 'fl[]': ['identifier'], 'rows': 5, 'output': 'json'},
                timeout=15, headers={'User-Agent': 'RetroCloud/1.0'}
            )
            r.raise_for_status()
            docs = r.json().get('response', {}).get('docs', [])
            for doc in docs:
                ident = doc.get('identifier')
                if not ident:
                    continue
                files_r = requests.get(f'https://archive.org/metadata/{ident}/files',
                                        timeout=15, headers={'User-Agent': 'RetroCloud/1.0'})
                files_r.raise_for_status()
                files = files_r.json().get('result', [])
                exts = ('.jpg', '.jpeg', '.png', '.webp')
                keywords = ['front', 'cover', 'box']
                # Tenta imagem de frente primeiro
                best = next((f for f in files
                             if any(f.get('name','').lower().endswith(e) for e in exts)
                             and any(k in f.get('name','').lower() for k in keywords)), None)
                # Fallback: qualquer imagem
                if not best:
                    best = next((f for f in files
                                 if any(f.get('name','').lower().endswith(e) for e in exts)), None)
                if best:
                    url = f"https://archive.org/download/{ident}/{best['name']}"
                    if _download(url, save_path):
                        return True
            time.sleep(0.3)
        except Exception as e:
            log.debug(f'Archive.org erro: {e}')
    return False


def _screenscraper(nome, sistema, user, pwd, save_path):
    if not user or not pwd:
        return False
    SYS = {'ps1':57,'psx':57,'snes':3,'n64':14,'gba':12,'gbc':10,'gb':9,'megadrive':1,'genesis':1,'md':1,'nes':3}
    sys_id = SYS.get(sistema.lower())
    if not sys_id:
        return False
    try:
        r = requests.get('https://www.screenscraper.fr/api2/jeuInfos.php',
            params={'devid':'retrocloud','devpassword':'retrocloud','softname':'retrocloud',
                    'output':'json','ssid':user,'sspassword':pwd,'systemeid':sys_id,
                    'romnom':nome,'media':'box-2D'}, timeout=15)
        r.raise_for_status()
        for m in r.json().get('response',{}).get('jeu',{}).get('medias',[]):
            if m.get('type') == 'box-2D':
                return _download(m['url'], save_path)
    except Exception as e:
        log.debug(f'ScreenScraper erro: {e}')
    return False


def _thegamesdb(nome, api_key, sistema, save_path):
    if not api_key:
        return False
    SYS = {'ps1':6,'psx':6,'snes':6004,'n64':3,'gba':5,'gbc':41,'gb':4,'megadrive':36,'nes':7}
    try:
        params = {'apikey': api_key, 'name': nome, 'include': 'boxart'}
        sys_id = SYS.get(sistema.lower())
        if sys_id:
            params['filter[platform]'] = sys_id
        r = requests.get('https://api.thegamesdb.net/v1/Games/ByGameName', params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        games = data.get('data',{}).get('games',[])
        if not games:
            return False
        gid = str(games[0]['id'])
        boxart = data.get('include',{}).get('boxart',{})
        base = boxart.get('base_url',{}).get('medium','')
        for img in boxart.get('data',{}).get(gid,[]):
            if img.get('side') == 'front':
                return _download(base + img['filename'], save_path)
    except Exception as e:
        log.debug(f'TheGamesDB erro: {e}')
    return False


def _steamgriddb(nome, api_key, save_path):
    if not api_key:
        return False
    try:
        h = {'Authorization': f'Bearer {api_key}'}
        r = requests.get('https://www.steamgriddb.com/api/v2/search/autocomplete',
                         params={'term': nome}, headers=h, timeout=10)
        r.raise_for_status()
        games = r.json().get('data', [])
        if not games:
            return False
        r2 = requests.get(f'https://www.steamgriddb.com/api/v2/grids/game/{games[0]["id"]}',
                          params={'dimensions': '600x900'}, headers=h, timeout=10)
        r2.raise_for_status()
        imgs = r2.json().get('data', [])
        if imgs:
            return _download(imgs[0]['url'], save_path)
    except Exception as e:
        log.debug(f'SteamGridDB erro: {e}')
    return False


# ── Função principal ──────────────────────────────────────────────────────────

def fetch_thumb(rom, upload_folder, cfg, nome_override=None):
    """
    Busca capa para uma ROM tentando todas as fontes disponíveis.
    nome_override: permite tentar com um nome alternativo (ex: sem acentos).
    Retorna caminho relativo '/static/...' ou None.
    """
    nome_busca = clean_name(nome_override or rom.nome or
                            os.path.splitext(os.path.basename(rom.caminho or ''))[0])
    sistema    = (rom.sistema or '').lower()
    save_path  = os.path.join(upload_folder, 'thumbs', f'rom_{rom.id}.jpg')
    thumb_rel  = f'/static/uploads/thumbs/rom_{rom.id}.jpg'

    sources = [
        ('Archive.org',   lambda: _archive_org(nome_busca, sistema, save_path)),
        ('ScreenScraper', lambda: _screenscraper(nome_busca, sistema,
                              cfg.get('SCREENSCRAPER_USER',''), cfg.get('SCREENSCRAPER_PASS',''), save_path)),
        ('TheGamesDB',    lambda: _thegamesdb(nome_busca, cfg.get('THEGAMESDB_API_KEY',''), sistema, save_path)),
        ('SteamGridDB',   lambda: _steamgriddb(nome_busca, cfg.get('STEAMGRIDDB_API_KEY',''), save_path)),
    ]

    for src_name, fn in sources:
        try:
            if fn():
                log.info(f'[{src_name}] Capa encontrada: "{nome_busca}"')
                return thumb_rel
        except Exception as e:
            log.warning(f'[{src_name}] Erro inesperado: {e}')

    log.info(f'Sem capa para: "{nome_busca}" ({sistema})')
    return None


def fetch_thumb_bg(rom_id, app):
    """Busca capa em thread separada (não bloqueia o request)."""
    def run():
        with app.app_context():
            from models import Rom, db
            rom = Rom.query.get(rom_id)
            if not rom or rom.thumb:
                return
            cfg = {k: app.config.get(k,'') for k in
                   ['SCREENSCRAPER_USER','SCREENSCRAPER_PASS',
                    'THEGAMESDB_API_KEY','STEAMGRIDDB_API_KEY']}
            path = fetch_thumb(rom, app.config['UPLOAD_FOLDER'], cfg)
            if path:
                rom.thumb = path
                db.session.commit()
    threading.Thread(target=run, daemon=True).start()


# ── Scheduler diário ──────────────────────────────────────────────────────────

class ThumbScheduler:
    def __init__(self, app):
        self.app = app
        self._stop = threading.Event()
        threading.Thread(target=self._loop, daemon=True).start()
        log.info('ThumbScheduler iniciado — roda diariamente')

    def stop(self): self._stop.set()

    def _loop(self):
        self._stop.wait(120)  # aguarda 2min após boot
        while not self._stop.is_set():
            self._run_once()
            self._stop.wait(86400)  # 24h

    def _run_once(self):
        with self.app.app_context():
            from models import Rom, db
            cfg = {k: self.app.config.get(k,'') for k in
                   ['SCREENSCRAPER_USER','SCREENSCRAPER_PASS',
                    'THEGAMESDB_API_KEY','STEAMGRIDDB_API_KEY']}
            upload_folder = self.app.config['UPLOAD_FOLDER']
            roms = Rom.query.filter((Rom.thumb == None) | (Rom.thumb == '')).all()
            if not roms:
                return
            log.info(f'ThumbScheduler: {len(roms)} ROMs sem capa')
            ok = 0
            for rom in roms:
                path = fetch_thumb(rom, upload_folder, cfg)
                if path:
                    rom.thumb = path
                    ok += 1
                time.sleep(1)  # respeita rate limit
            if ok:
                db.session.commit()
            log.info(f'ThumbScheduler: {ok}/{len(roms)} capas encontradas')
