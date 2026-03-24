"""
Scraper de capas usando libretro-thumbnails.
URL: https://thumbnails.libretro.com/{Sistema}/Named_Boxarts/{Nome}.png
Sem API key, sem conta, capas de alta qualidade.
"""

import os, re, time, logging, threading
import requests

log = logging.getLogger('thumb_scraper')

# Mapeamento sistema → nome libretro
LIBRETRO_SYSTEMS = {
    'snes':      'Nintendo - Super Nintendo Entertainment System',
    'n64':       'Nintendo - Nintendo 64',
    'nes':       'Nintendo - Nintendo Entertainment System',
    'gba':       'Nintendo - Game Boy Advance',
    'gbc':       'Nintendo - Game Boy Color',
    'gb':        'Nintendo - Game Boy',
    'ps1':       'Sony - PlayStation',
    'psx':       'Sony - PlayStation',
    'megadrive': 'Sega - Mega Drive - Genesis',
    'genesis':   'Sega - Mega Drive - Genesis',
    'md':        'Sega - Mega Drive - Genesis',
    'mastersystem': 'Sega - Master System - Mark III',
    'gamegear':  'Sega - Game Gear',
    'saturn':    'Sega - Saturn',
    'dreamcast': 'Sega - Dreamcast',
    'psp':       'Sony - PlayStation Portable',
    'ps2':       'Sony - PlayStation 2',
    'gba':       'Nintendo - Game Boy Advance',
    'nds':       'Nintendo - Nintendo DS',
    'gg':        'Sega - Game Gear',
    'sms':       'Sega - Master System - Mark III',
}

BASE_URL = 'https://thumbnails.libretro.com'


def clean_name(nome):
    """Remove extensão e artefatos do nome do arquivo."""
    nome = os.path.splitext(nome)[0]
    nome = re.sub(r'^[a-z]{2,5}_', '', nome)   # remove prefixos: snes_, ps1_
    nome = re.sub(r'[_]+', ' ', nome)
    return ' '.join(nome.split()).strip()


def _download(url, save_path):
    try:
        r = requests.get(url, timeout=20, stream=True,
                         headers={'User-Agent': 'RetroCloud/1.0'})
        if r.status_code != 200:
            return False
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        tmp = save_path + '.tmp'
        size = 0
        with open(tmp, 'wb') as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
                size += len(chunk)
        if size < 2048:  # menor que 2KB = inválido
            os.remove(tmp)
            return False
        os.replace(tmp, save_path)
        return True
    except Exception as e:
        log.debug(f'Download falhou {url}: {e}')
        if os.path.exists(save_path + '.tmp'):
            try: os.remove(save_path + '.tmp')
            except: pass
        return False


def _libretro(nome, sistema, save_path):
    """
    Busca capa no libretro-thumbnails.
    Tenta variações do nome para aumentar chance de acerto.
    """
    system_dir = LIBRETRO_SYSTEMS.get(sistema.lower())
    if not system_dir:
        log.debug(f'Sistema não mapeado: {sistema}')
        return False

    # Variações do nome para tentar
    variacoes = [
        nome,
        f'{nome} (USA)',
        f'{nome} (Europe)',
        f'{nome} (Japan)',
        f'{nome} (World)',
        # Artigo no final: "The Legend of Zelda" → "Legend of Zelda, The"
        re.sub(r'^(The|A|An) (.+)$', r'\2, \1', nome, flags=re.IGNORECASE),
    ]
    # Remove duplicatas mantendo ordem
    vistas = set()
    variacoes_unicas = []
    for v in variacoes:
        if v.lower() not in vistas:
            vistas.add(v.lower())
            variacoes_unicas.append(v)

    for variacao in variacoes_unicas:
        # libretro usa .png
        filename = requests.utils.quote(f'{variacao}.png')
        system_enc = requests.utils.quote(system_dir)
        url = f'{BASE_URL}/{system_enc}/Named_Boxarts/{filename}'
        log.debug(f'Tentando: {url}')
        if _download(url, save_path):
            log.info(f'✓ Capa encontrada: {variacao} ({sistema})')
            return True
        time.sleep(0.1)

    log.debug(f'✗ Sem capa: {nome} ({sistema})')
    return False


def fetch_thumb(rom, upload_folder, cfg, nome_override=None):
    """
    Busca capa para uma ROM.
    nome_override: nome alternativo enviado pelo usuário.
    Retorna caminho relativo '/static/...' ou None.
    """
    nome_raw = nome_override or rom.nome or os.path.basename(rom.caminho or '')
    nome     = clean_name(nome_raw)
    sistema  = (rom.sistema or '').lower()
    save_path = os.path.join(upload_folder, 'thumbs', f'rom_{rom.id}.png')
    thumb_rel = f'/static/uploads/thumbs/rom_{rom.id}.png'

    log.info(f'Buscando capa: "{nome}" ({sistema})')

    if _libretro(nome, sistema, save_path):
        return thumb_rel

    log.info(f'Sem capa para "{nome}" ({sistema})')
    return None


def fetch_thumb_bg(rom_id, app):
    """Busca capa em thread background."""
    def run():
        with app.app_context():
            from models import Rom, db
            rom = Rom.query.get(rom_id)
            if not rom or rom.thumb:
                return
            cfg = {}
            path = fetch_thumb(rom, app.config['UPLOAD_FOLDER'], cfg)
            if path:
                rom.thumb = path
                db.session.commit()
    threading.Thread(target=run, daemon=True).start()


class ThumbScheduler:
    """Scheduler desativado — thumbs só via admin manual."""
    def __init__(self, app):
        self.app = app
        log.info('ThumbScheduler: desativado, use o admin para buscar capas manualmente')

    def stop(self):
        pass
