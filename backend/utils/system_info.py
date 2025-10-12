import psutil
import platform
from datetime import datetime, timedelta

def get_system_info():
    """Retorna informações sobre o sistema."""
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # Memória
        memory = psutil.virtual_memory()
        memory_total = memory.total / (1024 ** 3)  # GB
        memory_used = memory.used / (1024 ** 3)  # GB
        memory_percent = memory.percent
        
        # Disco
        disk = psutil.disk_usage('/')
        disk_total = disk.total / (1024 ** 3)  # GB
        disk_used = disk.used / (1024 ** 3)  # GB
        disk_percent = disk.percent
        
        # Uptime
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = datetime.now() - boot_time
        uptime_str = str(uptime).split('.')[0]  # Remover microsegundos
        
        # Temperatura (pode não funcionar em todos os sistemas)
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                # Tentar obter temperatura da CPU
                cpu_temp = None
                for name, entries in temps.items():
                    if 'cpu' in name.lower() or 'coretemp' in name.lower():
                        cpu_temp = entries[0].current
                        break
                if not cpu_temp and temps:
                    # Pegar primeira temperatura disponível
                    cpu_temp = list(temps.values())[0][0].current
            else:
                cpu_temp = None
        except:
            cpu_temp = None
        
        return {
            'cpu': {
                'percent': cpu_percent,
                'count': cpu_count,
                'temperature': cpu_temp
            },
            'memory': {
                'total_gb': round(memory_total, 2),
                'used_gb': round(memory_used, 2),
                'percent': memory_percent
            },
            'disk': {
                'total_gb': round(disk_total, 2),
                'used_gb': round(disk_used, 2),
                'percent': disk_percent
            },
            'uptime': uptime_str,
            'platform': platform.system(),
            'platform_release': platform.release()
        }
    except Exception as e:
        return {'error': str(e)}

