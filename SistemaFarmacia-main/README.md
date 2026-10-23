# Farmácia Couto 🏥

Site inicial e landing page institucional da Farmácia Couto.

---

## 🚀 Estrutura dos Arquivos

Todo o conteúdo responsável pela parte inicial do site está organizado em `frontend/`:

- **`frontend/index.html`**: Página inicial do site (HTML).
- **`frontend/src/css/landing.css`**: Estilização visual e responsividade da landing page (CSS).
- **`frontend/src/js/`**: Scripts JavaScript da página inicial:
  - `main-landing.js`: Ponto de entrada e inicialização.
  - `reveal-landing.js`: Animações de rolagem (Scroll Reveal).
  - `ui-landing.js`: Utilitários de interface, máscaras e validações.
  - `contato-landing.js`: Lógica de envio do formulário de contato.
  - `clientes-landing.js`: Cadastro e listagem de clientes na landing.
  - `auth-landing.js`: Autenticação e sessão.
  - `config-landing.js`: Configurações de ambiente.
  - `core/supabase-landing.js`: Integração com o Supabase.

---

## 🛠️ Como Executar

### 1. Iniciar o servidor local de desenvolvimento:
```bash
npm run dev
```
Acesse em: `http://localhost:5173`

### 2. Gerar build de produção:
```bash
npm run build
```
Os arquivos prontos para publicação serão gerados na pasta `frontend/dist/`.