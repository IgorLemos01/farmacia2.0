# Farmácia Couto — Guia do Projeto

## Arquitetura

```
SistemaFarmacia/
├── frontend/          ← Landing Page (index.html) + Sistema (sistema.html) — Vite + Vanilla JS
└── backend/           ← API REST (Python + Flask + MySQL)
```

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

# Build de produção
npm run build
```

---

## Backend — API REST

**Tecnologia**: Python 3.11+ · Flask · SQLAlchemy · MySQL · JWT

### 1. Pré-requisitos
- Python 3.11 ou superior instalado.
- MySQL rodando localmente (ou via Docker).
- Banco de dados `farmacia_couto` criado no MySQL.

### 2. Instalar dependências Python

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
# Edite o arquivo .env com as credenciais do seu MySQL
```

### 4. Executar o servidor

```bash
# Na raiz do projeto:
npm run dev:backend

# Ou diretamente:
cd backend && python run.py
```

### 5. Testar os endpoints — Swagger UI

Após o servidor iniciar, acesse no navegador:

```
http://localhost:5000/api/docs
```

Você verá a interface do Swagger com todos os endpoints disponíveis para teste.

---

## Endpoints de Autenticação

| Método | Rota                     | Descrição                              |
|--------|--------------------------|----------------------------------------|
| POST   | /api/auth/cadastro       | Cria um novo usuário                   |
| POST   | /api/auth/login          | Retorna token JWT                      |
| GET    | /api/auth/me             | Dados do usuário logado (requer token) |
