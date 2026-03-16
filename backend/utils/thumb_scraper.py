"""
Scraper de capas — sem API key, sem conta.

Estratégia:
  1. Coleções fixas do Archive.org por sistema (mais confiável)
  2. ScreenScraper (se credenciais configuradas)
  3. TheGamesDB / SteamGridDB (se API key configurada)

Roda:
  - Em background ao cadastrar ROM nova
  - Diariamente via ThumbScheduler
"""

import os, re, time, logging, threading
import requests

log = logging.getLogger('thumb_scraper')

# Coleções do Archive.org com estrutura conhecida por sistema
# Formato: (identifier, padrão de arquivo, tipo)
ARCHIVE_SOURCES = {
    'snes': [
        # near-snes-scans-png: pasta "Nome do Jogo/box/front.png"
        ('near-snes-scans-png',   '{nome}/box/front.png',           'path'),
        # foxboxuk: "Nome do Jogo (USA).cover.png"
        ('foxboxuk',              '{nome} (USA).cover.png',         'path'),
        ('foxboxuk',              '{nome} (Europe).cover.png',      'path'),
        ('foxboxuk',              '{nome}.cover.png',               'path'),
        # GameScanner-SNES: "Nome do Jogo 01.jpg"
        ('GameScanner-SNES',      '{nome} 01.jpg',                  'path'),
    ],
    'megadrive': [
        ('segaboxarts',           '{nome} (USA).jpg',               'search'),
        ('GameScanner-Genesis',   '{nome} 01.jpg',                  'path'),
    ],
    'genesis': [
        ('segaboxarts',           '{nome} (USA).jpg',               'search'),
    ],
    'md': [
        ('segaboxarts',           '{nome} (USA).jpg',               'search'),
    ],
    'n64': [
        ('near-n64-scans-png',    '{nome}/box/front.png',           'path'),
        ('N64BoxArt',             '{nome} (USA).jpg',               'search'),
    ],
    'ps1': [
        ('psx-covers',            '{nome} (USA).jpg',               'search'),
        ('PlayStation-BoxArt',    '{nome}.jpg',                     'search'),
    ],
    'psx': [
        ('psx-covers',            '{nome} (USA).jpg',               'search'),
    ],
    'gba': [
        ('gba-box-art',           '{nome} (USA).jpg',               'search'),
    ],
    'gbc': [
        ('gbc-box-art',           '{nome} (USA).jpg',               'search'),
    ],
    'gb': [
        ('gb-box-art',            '{nome} (USA).jpg',               'search'),
    ],
    'nes': [
        ('near-nes-scans-png',    '{nome}/box/front.png',           'path'),
    ],
}


def clean_name(nome):
    """Remove extensão, prefixos de sistema e artefatos do nome do arquivo."""
    nome = os.path.splitext(nome)[0]
    nome = re.sub(r'^[a-z]{2,5}_', '', nome)               # snes_, ps1_, etc
    nome = re.sub(r'[\(\[\{][^\)\]\}]*[\)\]\}]', '', nome) # (USA), [!], etc
    nome = re.sub(r'[_\-]+', ' ', nome)
    return ' '.join(nome.split()).strip()


def _download(url, save_path):
    try:
        r = requests.get(url, timeout=30, stream=True,
                         headers={'User-Agent': 'RetroCloud/1.0'})
        r.raise_for_status()
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        tmp_path = save_path + '.tmp'
        size = 0
        with open(tmp_path, 'wb') as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
                size += len(chunk)
        # Verifica tamanho mínimo (imagem válida > 5KB)
        if size < 5120:
            os.remove(tmp_path)
            log.debug(f'Arquivo muito pequeno ({size}b), descartado: {url}')
            return False
        os.replace(tmp_path, save_path)
        return True
    except Exception as e:
        log.debug(f'Download falhou {url}: {e}')
        if os.path.exists(save_path + '.tmp'):
            os.remove(save_path + '.tmp')
        return False


def _try_archive_direct(nome, sistema, save_path):
    """
    Tenta baixar diretamente de coleções fixas do Archive.org.
    Muito mais rápido e confiável do que a API de busca.
    """
    sources = ARCHIVE_SOURCES.get(sistema.lower(), [])
    nome_clean = clean_name(nome)

    # Variações do nome para tentar
    variações = [
        nome_clean,
        nome_clean.title(),
        # Remove artigos do início: "The 7th Saga" → "7th Saga, The"
        re.sub(r'^(The|A|An) (.+)$', r'\2, \1', nome_clean, flags=re.IGNORECASE),
    ]
    variações = list(dict.fromkeys(variações))  # remove duplicatas mantendo ordem

    for identifier, pattern, _ in sources:
        for variacao in variações:
            filename = pattern.format(nome=variacao)
            url = f'https://archive.org/download/{identifier}/{requests.utils.quote(filename)}'
            log.debug(f'Tentando: {url}')
            if _download(url, save_path):
                log.info(f'Capa encontrada: {identifier}/{filename}')
                return True
            time.sleep(0.2)

    return False


def _try_archive_search(nome, sistema, save_path):
    """Fallback: usa API de busca do Archive.org."""
    nome_clean = clean_name(nome)
    collection = {
        'snes': 'subject:SNES', 'n64': 'subject:N64',
        'ps1': 'subject:PlayStation', 'psx': 'subject:PlayStation',
        'megadrive': 'subject:Genesis', 'genesis': 'subject:Genesis', 'md': 'subject:Genesis',
        'gba': 'subject:GBA', 'gbc': 'subject:GBC', 'gb': 'subject:"Game Boy"',
        'nes': 'subject:NES',
    }.get(sistema.lower(), '')

    query = f'title:"{nome_clean}" AND {collection} AND (subject:"box art" OR subject:"covers")'
    try:
        r = requests.get('https://archive.org/advancedsearch.php',
                         params={'q': query, 'fl[]': ['identifier'], 'rows': 3, 'output': 'json'},
                         timeout=15, headers={'User-Agent': 'RetroCloud/1.0'})
        r.raise_for_status()
        docs = r.json().get('response', {}).get('docs', [])
        for doc in docs:
            ident = doc.get('identifier')
            if not ident:
                continue
            files_r = requests.get(f'https://archive.org/metadata/{ident}/files',
                                    timeout=10, headers={'User-Agent': 'RetroCloud/1.0'})
            files_r.raise_for_status()
            files = files_r.json().get('result', [])
            exts = ('.jpg', '.jpeg', '.png', '.webp')
            best = next((f for f in files
                         if any(f.get('name','').lower().endswith(e) for e in exts)
                         and any(k in f.get('name','').lower() for k in ['front','cover','box'])), None)
            if not best:
                best = next((f for f in files
                             if any(f.get('name','').lower().endswith(e) for e in exts)), None)
            if best:
                url = f"https://archive.org/download/{ident}/{requests.utils.quote(best['name'])}"
                if _download(url, save_path):
                    return True
        time.sleep(0.3)
    except Exception as e:
        log.debug(f'Archive search erro: {e}')
    return False


def _screenscraper(nome, sistema, user, pwd, save_path):
    if not user or not pwd:
        return False
    SYS = {'ps1':57,'psx':57,'snes':3,'n64':14,'gba':12,'gbc':10,'gb':9,
           'megadrive':1,'genesis':1,'md':1,'nes':3}
    sys_id = SYS.get(sistema.lower())
    if not sys_id:
        return False
    try:
        r = requests.get('https://www.screenscraper.fr/api2/jeuInfos.php',
            params={'devid':'retrocloud','devpassword':'retrocloud','softname':'retrocloud',
                    'output':'json','ssid':user,'sspassword':pwd,
                    'systemeid':sys_id,'romnom':nome,'media':'box-2D'}, timeout=15)
        r.raise_for_status()
        for m in r.json().get('response',{}).get('jeu',{}).get('medias',[]):
            if m.get('type') == 'box-2D':
                return _download(m['url'], save_path)
    except Exception as e:
        log.debug(f'ScreenScraper erro: {e}')
    return False


def _thegamesdb(nome, sistema, api_key, save_path):
    if not api_key:
        return False
    SYS = {'ps1':6,'psx':6,'snes':6004,'n64':3,'gba':5,'gbc':41,'gb':4,'megadrive':36,'nes':7}
    try:
        params = {'apikey': api_key, 'name': clean_name(nome), 'include': 'boxart'}
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
                         params={'term': clean_name(nome)}, headers=h, timeout=10)
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
    Busca capa para uma ROM tentando todas as fontes.
    nome_override: nome alternativo enviado pelo usuário.
    Retorna caminho relativo '/static/...' ou None.
    """
    nome    = nome_override or rom.nome or \
              clean_name(os.path.splitext(os.path.basename(rom.caminho or ''))[0])
    sistema = (rom.sistema or '').lower()
    save_path = os.path.join(upload_folder, 'thumbs', f'rom_{rom.id}.jpg')
    thumb_rel = f'/static/uploads/thumbs/rom_{rom.id}.jpg'

    log.info(f'Buscando capa: "{nome}" ({sistema})')

    sources = [
        ('Archive.org direto',  lambda: _try_archive_direct(nome, sistema, save_path)),
        ('Archive.org busca',   lambda: _try_archive_search(nome, sistema, save_path)),
        ('ScreenScraper',       lambda: _screenscraper(nome, sistema,
                                    cfg.get('SCREENSCRAPER_USER',''), cfg.get('SCREENSCRAPER_PASS',''), save_path)),
        ('TheGamesDB',          lambda: _thegamesdb(nome, sistema, cfg.get('THEGAMESDB_API_KEY',''), save_path)),
        ('SteamGridDB',         lambda: _steamgriddb(nome, cfg.get('STEAMGRIDDB_API_KEY',''), save_path)),
    ]

    for src_name, fn in sources:
        try:
            if fn():
                log.info(f'[OK] {src_name}: capa salva para "{nome}"')
                return thumb_rel
        except Exception as e:
            log.warning(f'[ERRO] {src_name}: {e}')

    log.info(f'[FALHA] Sem capa para "{nome}" ({sistema})')
    return None


def fetch_thumb_bg(rom_id, app):
    """Busca capa em thread background (não bloqueia o request)."""
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
        log.info('ThumbScheduler iniciado — roda 2min após boot e depois a cada 24h')

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
                log.info('ThumbScheduler: todas as ROMs têm capa.')
                return
            log.info(f'ThumbScheduler: {len(roms)} ROMs sem capa')
            ok = 0
            for rom in roms:
                path = fetch_thumb(rom, upload_folder, cfg)
                if path:
                    rom.thumb = path
                    ok += 1
                time.sleep(1)
            if ok:
                db.session.commit()
            log.info(f'ThumbScheduler: {ok}/{len(roms)} capas encontradas')
