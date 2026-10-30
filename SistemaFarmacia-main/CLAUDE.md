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
- Toda alteração na `main` publica automaticamente a versão de demonstração no GitHub Pages
  (`.github/workflows/pages.yml`: roda os testes do frontend, faz o build e publica).
- A hospedagem definitiva (Hostinger) é atualizada manualmente: ver "Publicação" abaixo.

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
- `JWT_EXPIRES_HOURS` — duração do login (padrão 8 h).
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
como `admin`. A partir daí, só um admin logado cadastra novos usuários, pela tela
**Configurações** do sistema (ou pelo Swagger).

**Gestão de usuários** (somente admin, perfil conferido no banco a cada chamada):
- Usuários não são excluídos: desative o acesso. A desativação vale **na hora**, mesmo para
  quem está logado (o token passa a responder 401).
- O admin não pode rebaixar nem desativar a si mesmo (sempre sobra um admin ativo).

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

## Endpoints de Usuários (somente admin)

| Método | Rota                | Descrição                                                    |
|--------|---------------------|--------------------------------------------------------------|
| GET    | /api/usuarios       | Lista os usuários                                            |
| PUT    | /api/usuarios/{id}  | Altera nome, perfil, ativo (desativar) ou redefine a senha   |

## Endpoints do Catálogo de Exames

| Método | Rota                              | Quem                | Descrição                                              |
|--------|-----------------------------------|---------------------|--------------------------------------------------------|
| GET    | /api/catalogo-exames?ativos=true  | qualquer logado     | Lista (só os disponíveis com `ativos=true`)            |
| POST   | /api/catalogo-exames              | admin               | Adiciona exame (`nome`, `valor`)                       |
| PUT    | /api/catalogo-exames/{id}         | admin               | Altera `nome`, `valor` ou `ativo` (false = remover)    |
| POST   | /api/catalogo-exames/importar     | admin               | Importa `{itens: [{nome, valor}]}`; nome existente tem o valor atualizado |

Como funciona:
- O catálogo mora no **banco** (tabela `catalogo_exames`, criada sozinha na primeira execução;
  o SQL manual está em `backend/db/`). Nunca coloque preços no código: o repositório é público.
- **Exame é sempre escolhido no catálogo**: `POST /api/exames` exige `catalogo_id`; nome e valor
  são **copiados** para o registro e valem para sempre. Mudar o preço no catálogo não altera exames
  já feitos. O valor enviado pelo cliente é ignorado.
- Exame registrado não muda de nome/valor (`PUT /api/exames` só altera data, pagamento e
  observações). Para corrigir, exclua o registro e cadastre de novo.
- "Remover" do catálogo apenas desativa (`ativo=false`): some da lista de escolha, o histórico fica.
- Nomes são únicos sem diferenciar maiúsculas; nomes de 1 letra são válidos (ex.: `K`).
- Na tela: **Configurações → Catálogo de Exames** (só admin). A importação lê um CSV no navegador
  (separador `;`, `,` ou tabulação; valores como `13`, `13,50` ou `R$ 1.250,00`; Excel do Windows ok).
  **Reimportar devolve os exames existentes ao valor do arquivo.**
- No modo demonstração o catálogo é uma amostra fictícia (os preços reais não ficam no site público).

## Receitas e catálogo de medicamentos

**Catálogo** (tabela `catalogo_medicamentos`: RMS, descrição, laboratório) — mesmas regras do catálogo
de exames: só o admin cria/edita/desativa/importa; qualquer logado consulta. A identidade de um item é
o par **RMS + descrição**. Tela: **Configurações → Catálogo de Medicamentos**.

| Método | Rota                                | Quem            | Descrição                                           |
|--------|-------------------------------------|-----------------|-----------------------------------------------------|
| GET    | /api/catalogo-medicamentos?ativos=true | qualquer logado | Lista (só os disponíveis com `ativos=true`)         |
| POST   | /api/catalogo-medicamentos          | admin           | Adiciona (`descricao`, `rms`?, `laboratorio`?)      |
| PUT    | /api/catalogo-medicamentos/{id}     | admin           | Altera campos ou `ativo` (false = remover)          |
| POST   | /api/catalogo-medicamentos/importar | admin           | Importa `{itens: [{rms, descricao, laboratorio}]}`  |

- **Importar CSV**: colunas `RMS`, `Descrição`, `Laboratório` (colunas extras como Lote/Quantidade são
  ignoradas, então a planilha de estoque serve). O RMS tem 13 dígitos e é tratado como **texto**:
  **não abra e salve o CSV no Excel** (ele converte para notação científica e apaga dígitos; a importação
  recusa essas linhas). Reimportar atualiza o laboratório de quem já existe e nunca apaga nada.
- **Receita** = cabeçalho (`receitas`: paciente, data, médico opcional, observações) + itens
  (`receita_itens`). `POST /api/receitas` recebe `itens: [{catalogo_id, dose?, posologia?, lote?, validade?,
  quantidade?}]` (de 1 a 12). **RMS, descrição e laboratório são copiados do catálogo** no momento da
  receita e não mudam se o catálogo mudar. No `PUT`, `itens` substitui a lista; `{id}` de um item existente
  mantém a cópia original, `{catalogo_id}` troca por um do catálogo.
- Medicamento é sempre escolhido do catálogo (a tela e a API recusam texto livre).
- **PDF**: gerado no navegador com jsPDF (carregado sob demanda, ~130 KB comprimido, só quando se pede o
  PDF), no padrão da ficha da farmácia. Textos fixos em `src/js/pdf.js` (`EMPRESA`, `FARMACEUTICO`,
  `AVISO_LEGAL`). A ficha tem no mínimo 3 blocos de medicamento (em branco para preencher à mão). Dose,
  posologia, médico e observações ficam salvos no sistema mas **não saem no PDF** (a ficha não tem
  espaço para eles).
- **Mudança de banco**: `receitas` perdeu a coluna `medicamentos` e ganhou `observacoes`
  (`medico_prescritor` agora é opcional), e existe a tabela nova `receita_itens`. Se o banco já tinha a
  tabela `receitas` antiga, apague-a antes (`DROP TABLE receitas;`) para a nova ser criada.

## Editar e excluir registros

Clientes, manipulações, exames e receitas têm `PUT` e `DELETE` na API e botões de editar/excluir
na tela. O paciente de um registro não pode ser trocado. Cliente com manipulações, exames ou
receitas vinculados não pode ser excluído.
