# RetroCloud M5 — Edição Pro

Plataforma web para jogar ROMs de videogames retro diretamente no navegador, com controle de usuários, interface moderna e painel administrativo completo.

## 🚀 Recursos

- **Autenticação de Usuários**: Sistema completo de login/registro com JWT
- **Biblioteca de Jogos**: Interface estilo Steam/EmulationStation
- **Painel Administrativo**: Gerenciamento de ROMs, usuários, sessões e sistema
- **Saves Isolados**: Cada usuário tem seus próprios saves
- **Emulação no Navegador**: Jogos executados via EmulatorJS
- **Monitoramento**: Estatísticas de CPU, RAM, disco e temperatura
- **Acesso Remoto**: Suporte para Cloudflare Tunnel (HTTPS)

## 📋 Requisitos

- Docker e Docker Compose
- Banana Pi M5 ou Raspberry Pi (ou qualquer servidor Linux)
- Mínimo 2GB RAM
- 16GB de armazenamento (mais para ROMs)

## 🛠️ Instalação

### 1. Clone ou copie o projeto

```bash
cd /home/pi
git clone <seu-repositorio> retrocloud
cd retrocloud
```

### 2. Ajuste as configurações

Edite o arquivo `docker-compose.yml` e altere:
- `SECRET_KEY`: Gere uma chave secreta forte
- `REACT_APP_API_URL`: Ajuste para o IP/domínio do seu servidor

### 3. Inicie os containers

```bash
docker-compose up -d
```

### 4. Crie o primeiro usuário administrador

Acesse o banco de dados e altere o campo `is_admin` para `True`:

```bash
docker exec -it retrocloud_backend python3 -c "
from app import create_app
from models import db, User
app = create_app()
with app.app_context():
    user = User.query.filter_by(email='seu@email.com').first()
    if user:
        user.is_admin = True
        db.session.commit()
        print('Usuário promovido a admin!')
"
```

## 🎮 Uso

### Acessar a Plataforma

- **Frontend**: http://localhost (ou IP do servidor)
- **Backend API**: http://localhost:5000
- **EmulatorJS**: http://localhost:8080

### Adicionar ROMs

1. Faça login como administrador
2. Acesse o Painel Administrativo
3. Clique em "Adicionar ROM"
4. Faça upload da ROM e thumbnail
5. Preencha as informações (nome, sistema, descrição)
6. Clique em "Adicionar ROM"

### Sistemas Suportados

- NES
- SNES
- Game Boy / Game Boy Color / Game Boy Advance
- Nintendo 64
- PlayStation 1
- Sega Genesis
- E outros suportados pelo EmulatorJS

## 🔧 Configuração Avançada

### Cloudflare Tunnel

Para acesso público via HTTPS:

1. Instale o Cloudflare Tunnel:
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

2. Autentique:
```bash
cloudflared tunnel login
```

3. Crie um tunnel:
```bash
cloudflared tunnel create retrocloud
```

4. Configure o tunnel para apontar para `http://localhost:80`

### Limites e Restrições

No painel administrativo, você pode:
- Definir número máximo de sessões simultâneas
- Ativar limite de tempo por sessão
- Encerrar sessões individuais
- Gerenciar saves dos usuários

## 📁 Estrutura de Diretórios

```
retrocloud/
├── backend/          # API Flask
├── frontend/         # Interface React
├── emulatorjs/       # ROMs e saves
│   ├── roms/         # ROMs organizadas por sistema
│   └── saves/        # Saves isolados por usuário
├── nginx/            # Configuração do proxy reverso
└── docker-compose.yml
```

## 🐛 Solução de Problemas

### Backend não inicia
- Verifique os logs: `docker logs retrocloud_backend`
- Certifique-se de que a porta 5000 está disponível

### Frontend não carrega
- Verifique os logs: `docker logs retrocloud_frontend`
- Confirme que `REACT_APP_API_URL` está correto

### ROMs não aparecem
- Verifique se o upload foi bem-sucedido
- Confirme que os arquivos estão em `/emulatorjs/roms/<sistema>/`
- Verifique permissões dos arquivos

### Emulador não funciona
- Confirme que o EmulatorJS está rodando: `docker ps`
- Verifique se a ROM é compatível com o sistema

## 📊 Monitoramento

O painel administrativo exibe:
- Uso de CPU e temperatura
- Uso de memória RAM
- Uso de disco
- Uptime do sistema
- Sessões ativas
- Total de ROMs e saves

## 🔐 Segurança

- Senhas são criptografadas com bcrypt
- Tokens JWT com expiração de 24 horas
- Validação de tipos de arquivo no upload
- Sessões podem ser encerradas remotamente
- Limite de sessões simultâneas configurável

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:
1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📝 Licença

Este projeto é fornecido "como está", sem garantias.

## 🙏 Agradecimentos

- EmulatorJS pela biblioteca de emulação
- Flask e React pelas frameworks
- Comunidade open source

