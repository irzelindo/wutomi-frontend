# Wutomi UI

Frontend separado da API Wutomi, em React + Vite + TypeScript.

## Desenvolvimento

API:

```bash
cd /home/irzelindo/wutomi
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

UI:

```bash
cd /home/irzelindo/wutomi_ui
npm install
npm run dev
```

Abra:

```text
http://localhost:5173
```

A UI comunica por defeito com:

```text
https://api.wutomi.com
```

Pode alterar a base URL em `.env`:

```bash
cp .env.example .env
```

## Funcionalidades cobertas

- Login com email/senha
- Cadastro de novo utilizador
- Recuperacao de senha
- OAuth via providers configurados na API
- Selecao de tipo de utilizador: paciente, medico, hospital e admin
- Perfil editavel com dados pessoais e operacionais
- Dashboard operacional
- Agendamento hospitalar presencial
- Consultas e transicoes principais de estado
- Pacientes, medicos, hospitais e especialidades
- Prontuario clinico
- Notificacoes e preferencias por canal
- Carteira e carregamento por M-Pesa, mKesh ou e-Mola
- Area admin com indicadores
- Modo demonstracao com dados ficticios quando nao ha sessao

## Observacoes

Alguns fluxos dependem de permissao da API. Por exemplo, carteira e prontuario podem exigir utilizador medico/admin, e endpoints admin exigem conta admin.
