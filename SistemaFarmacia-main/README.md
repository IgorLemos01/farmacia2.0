# Farmácia Couto 🏥

Landing page institucional + sistema de gestão interno da Farmácia Couto.

---

## 🚀 Estrutura do Frontend (`frontend/`)

O frontend é um build **multi-página** do Vite:

| Página | Arquivo | Descrição |
|---|---|---|
| `/` | `index.html` | Landing page institucional |
| `/sistema.html` | `sistema.html` | Sistema de gestão (aberto pelo botão **🔐 Área Interna**) |

- **Landing page**
  - `src/css/landing.css`: estilos da landing.
  - `src/js/landing.js`: animação do hero (canvas) e scroll reveal.
  - `src/assets/logo.png`: logo (um único arquivo, cacheado pelo navegador).
- **Sistema**
  - `src/css/{variables,layout,components,dashboard}.css`: design system.
  - `src/js/app.js`: roteador e login; `src/js/views/*`: telas; `src/js/api.js`: cliente da API Flask.
  - Sem `VITE_API_URL` configurada, o sistema roda em **modo demonstração** (dados fictícios, sem login).
    Veja `frontend/.env.example` e o `CLAUDE.md` para configurar a API real.

---

## 🛠️ Como Executar

### 1. Servidor local de desenvolvimento
```bash
npm run dev:frontend
```
Acesse em: `http://localhost:5173` (landing) e `http://localhost:5173/sistema.html` (sistema).

### 2. Testes
```bash
npm test --prefix frontend          # frontend (vitest)
cd backend && python -m pytest      # backend (pytest)
```

### 3. Build de produção
```bash
npm run build
```
Os arquivos prontos para publicação serão gerados em `frontend/dist/`.
