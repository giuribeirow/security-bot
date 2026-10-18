# Mineiro Security

Bot separado de segurança inteligente para Discord.

## O que ele faz

- Analisa mensagens em tempo real.
- Detecta flood, spam, golpes, phishing, tokens, ameaças e discurso ofensivo.
- Analisa links suspeitos, convites, encurtadores e downloads perigosos.
- Analisa imagens PNG/JPG e detecta QR codes suspeitos.
- Monitora entradas para risco de raid.
- Aplica punições por nível de risco: log, delete, aviso, timeout, kick ou ban.
- Mantém reputação por usuário.
- Envia logs em canal privado configurado.
- Tem painel por servidor em Container V2.
- Suporta IA opcional por API compatível com OpenAI/NVIDIA.

## Configuração

1. Copie `.env.example` para `.env`. ou use em terminal `cp .env.example .env`
2. Preencha:

```env
DISCORD_TOKEN=TOKEN_DO_BOT
CLIENT_ID=ID_DA_APLICACAO
GUILD_ID=ID_DO_SERVIDOR_PARA_TESTE
```

3. Ative no portal do Discord:

- Server Members Intent
- Message Content Intent

4. Instale as dependências:

```bash
npm install
```

5. Registre os comandos:

```bash
npm run deploy
```

6. Inicie:

```bash
npm start
```

## Comando principal

```txt
/vanguard painel
```

Use o painel para configurar módulos, logs, links, punições, reputação, raid, imagens e IA.

## IA opcional

O bot funciona sem IA usando heurísticas locais. Para ativar IA:

```env
AI_API_KEY=SUA_CHAVE
AI_BASE_URL=https://integrate.api.nvidia.com/v1
AI_MODEL=nvidia/nvidia-nemotron-nano-9b-v2
```

Depois ative no painel:

- Módulos > IA
- IA > Usar API

## Permissões recomendadas

- Ver canais
- Ler histórico
- Enviar mensagens
- Gerenciar mensagens
- Moderar membros
- Expulsar membros
- Banir membros

Para timeout, kick e ban funcionarem, o cargo do bot precisa ficar acima do cargo dos membros punidos.
