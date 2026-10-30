# Farmácia Couto — Guia do Projeto

## Arquitetura

```
SistemaFarmacia/
├── frontend/          ← Landing Page (index.html) + Sistema (sistema.html) — Vite + Vanilla JS
└── backend/           ← API REST (Python + Flask + MySQL)
```

---

## Fluxo de Git

- **Envie as alterações direto para a branch `main`** (autorizado pelo dono do repositório).
  Ao terminar uma mudança: verifique o build (`npm run build`), faça o commit e `git push origin HEAD:main`.
- A hospedagem (Hostinger) é atualizada manualmente: ver "Publicação" abaixo.

---

## Frontend — Landing Page + Sistema

**Tecnologia**: Vite + Vanilla JS (build multi-página)

- `index.html` → landing page institucional (`src/css/landing.css`, `src/js/landing.js`)
- `sistema.html` → sistema de gestão, aberto pelo botão "Área Interna" da landing

```bash
# Instalar dependências
npm install --prefix frontend

# Executar servidor local (http://localhost:5173)
npm run dev:frontend

# Testes (vitest)
npm test --prefix frontend

# Build de produção
npm run build
```

### Modo API x modo demonstração

- Com `VITE_API_URL` definida em `frontend/.env` **no momento do build**, o sistema usa a API
  real e exige login. Erros da API aparecem na tela — não há fallback para dados fictícios.
- Sem `VITE_API_URL`, o sistema roda em **modo demonstração**: dados fictícios guardados só
  no navegador, sem login, com o aviso "Modo demonstração" no topo.
- Ao publicar a API, adicione o domínio dela em `connect-src` do `Content-Security-Policy`
  em `frontend/public/.htaccess` (hoje só `'self'` é permitido).
- Todo dado vindo do usuário/banco deve passar por `escapeHtml` (`src/js/utils.js`) antes de
  entrar em templates HTML.

### Publicação (Hostinger)

O frontend é estático: o build gera `frontend/dist/` com `index.html` (landing),
`sistema.html`, a pasta `assets/` e o `.htaccess` (cabeçalhos de segurança e cache,
vindo de `frontend/public/.htaccess`).

1. `npm run build` (na raiz do projeto)
2. No hPanel da Hostinger → Gerenciador de Arquivos → `public_html`, envie **todo o conteúdo**
   de `frontend/dist/` (inclusive o `.htaccess`, que é um arquivo oculto).

Os caminhos são relativos (`base: './'` no Vite), então o site também funciona dentro de
uma subpasta. A API Flask não roda em hospedagem compartilhada: precisa de um plano VPS
(no VPS, prefira `DB_TYPE=mysql`).

---

## Backend — API REST

**Tecnologia**: Python 3.11+ · Flask · SQLAlchemy · SQL Server (padrão) ou MySQL · JWT

### 1. Pré-requisitos
- Python 3.11 ou superior instalado.
- **SQL Server** (padrão, com ODBC Driver 18) **ou MySQL**, com o banco `farmacia_couto` criado.
  O tipo é escolhido por `DB_TYPE` no `.env` (`mssql` ou `mysql`).
- As tabelas são criadas automaticamente na primeira execução (`db.create_all()`).
  Os scripts em `backend/db/` (`schema_sqlserver.sql` e `schema.sql` para MySQL) são
  alternativas para criação manual.

### 2. Instalar dependências Python

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
```

### 3. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Variáveis principais (detalhes no `.env.example`):
- `DB_TYPE`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_TRUSTED_CONNECTION`
- `JWT_SECRET_KEY` — **obrigatória em produção** (a API não sobe sem ela). Em desenvolvimento,
  se vazia, é gerado um segredo temporário.
- `CORS_ORIGINS` — sites autorizados a chamar a API (inclua o domínio do frontend).

### 4. Executar o servidor

```bash
# Na raiz do projeto:
npm run dev:backend

# Ou diretamente:
cd backend && python run.py
```

### 5. Criar o primeiro usuário (administrador)

Com o banco vazio, o **primeiro** `POST /api/auth/cadastro` não exige login e cria a conta
como `admin`. A partir daí, só um admin logado consegue cadastrar novos usuários.

### 6. Testes

```bash
cd backend && python -m pytest
```

Os testes usam SQLite em memória — não precisam do SQL Server/MySQL.

### 7. Testar os endpoints — Swagger UI

Após o servidor iniciar, acesse no navegador:

```
http://localhost:5000/api/docs
```

Você verá a interface do Swagger com todos os endpoints disponíveis para teste.

---

## Endpoints de Autenticação

| Método | Rota                     | Descrição                                                        |
|--------|--------------------------|------------------------------------------------------------------|
| POST   | /api/auth/cadastro       | Cria usuário — exige token de admin (exceto o primeiro usuário)  |
| POST   | /api/auth/login          | Retorna token JWT                                                |
| GET    | /api/auth/me             | Dados do usuário logado (requer token)                           |
