# Farmácia Couto — Guia do Projeto

## Arquitetura

```
SistemaFarmacia/
├── frontend/          ← Landing Page (index.html) + Sistema (sistema.html) — Vite + Vanilla JS
└── backend/           ← API REST (Python + Flask + MySQL)
```

---

## Fluxo de Git

- **Envie as alterações direto para a branch `main`** (autorizado pelo dono do repositório), depois que
  o dono confirmar que em Settings → Pages a *Source* está em **GitHub Actions** (com "Deploy from a branch"
  o site dá 404). Ao terminar uma mudança: verifique o build (`npm run build`), faça o commit e `git push origin HEAD:main`.
- Toda alteração na `main` publica automaticamente a versão de demonstração no GitHub Pages
  (`.github/workflows/pages.yml`: roda os testes do frontend, faz o build e publica).
- A hospedagem definitiva (Hostinger) é atualizada manualmente: ver "Publicação" abaixo.

---

## Frontend — Landing Page + Sistema

**Tecnologia**: Vite + Vanilla JS (build multi-página)

- `index.html` → landing page institucional (`src/css/landing.css`, `src/js/landing.js`)
- `login.html` → entrada do sistema (e-mail e senha), aberta pelo botão "Área Interna" da landing
- `sistema.html` → sistema de gestão; sem login volta para `login.html`
- `privacidade.html` → Política de Privacidade (LGPD), ligada no rodapé da landing. Ao mudar a forma de tratar
  dados de clientes, atualize o texto e a data no topo da página.
- Botão **Novo Atendimento** (topo do sistema): menu com Nova manipulação, Registrar exames, Nova receita e
  Novo cliente; cada opção só aparece para quem tem o módulo e já abre o formulário da tela.

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
  real e exige login (e-mail e senha em `login.html`). Erros da API aparecem na tela — não há fallback para dados fictícios.
- Sem `VITE_API_URL`, o sistema roda em **modo demonstração**: dados fictícios guardados só
  no navegador, com o aviso "Modo demonstração". Em `login.html` escolhe-se um usuário fictício
  (administrador ou funcionário com módulos limitados), sem senha, para ver como cada perfil enxerga o sistema.
- Ao publicar a API, adicione o domínio dela em `connect-src` do `Content-Security-Policy`
  em `frontend/public/.htaccess` (hoje só `'self'` é permitido).
- Todo dado vindo do usuário/banco deve passar por `escapeHtml` (`src/js/utils.js`) antes de
  entrar em templates HTML.

### Publicação (Hostinger)

O frontend é estático: o build gera `frontend/dist/` com `index.html` (landing),
`login.html`, `sistema.html`, `privacidade.html`, a pasta `assets/` e o `.htaccess` (cabeçalhos de segurança e cache,
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

### 5. Criar o administrador e os usuários

O cadastro **não é aberto**: `POST /api/auth/cadastro` só aceita token de administrador. Por isso o
**primeiro administrador é criado no terminal**, no servidor, e a senha nunca fica no repositório:

```bash
cd backend
flask --app run criar-admin --nome "Seu Nome" --email voce@farmacia.com   # pede a senha (oculta)
flask --app run criar-admin --nome "Seu Nome" --email voce@farmacia.com --gerar-senha   # gera e mostra uma senha
flask --app run redefinir-senha --email voce@farmacia.com                 # se esquecer a senha
```

(`--senha` ou a variável `ADMIN_SENHA` também servem para scripts.) Depois, o administrador cria os demais
usuários em **Configurações → Usuários**, escolhendo o **perfil** e os **módulos**.

**Perfis e módulos** (regra aplicada no servidor em toda rota; a tela só esconde o que daria 403):
- `admin`: todos os módulos + Configurações (usuários e catálogos).
- `funcionario`: só os módulos marcados (`dashboard`, `clientes`, `manipulacoes`, `exames`, `receitas`;
  ao menos um). Guardados em `usuarios.modulos`, separados por vírgula.
- Dashboard é só consulta das listas e dos relatórios de todas as categorias. Quem tem Manipulações, Exames ou
  Receitas também **consulta, cadastra (cadastro rápido) e completa** clientes, para atender no balcão; excluir e
  abrir o dossiê exigem o módulo Clientes. O relatório de uma categoria vale para quem tem aquele módulo ou o Dashboard.
- Permissões são lidas do banco a cada chamada: mudar módulos ou desativar vale **na hora**, sem novo login.
- Senha: mínimo de 6 caracteres. Recomendado como próximo passo: limite de tentativas de login e mínimo de 8.

**Gestão de usuários** (somente admin):
- Usuários não são excluídos: desative o acesso (o token passa a responder 401).
- O admin não pode rebaixar nem desativar a si mesmo (sempre sobra um admin ativo).
- **Mudança de banco**: `usuarios.perfil` agora é `admin`/`funcionario` (antes `atendente`) e existe a
  coluna `modulos`. Banco novo: nada a fazer. Banco antigo: ver `backend/db/` e ajuste a tabela.

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
| POST   | /api/auth/cadastro       | Cria usuário (`perfil`, `modulos`) — exige token de admin        |
| POST   | /api/auth/login          | Retorna token JWT                                                |
| GET    | /api/auth/me             | Dados do usuário logado, com perfil e módulos (requer token)     |

## Endpoints de Usuários

| Método | Rota                        | Quem                    | Descrição                                                    |
|--------|-----------------------------|-------------------------|--------------------------------------------------------------|
| GET    | /api/usuarios               | admin                   | Lista os usuários                                            |
| PUT    | /api/usuarios/{id}          | admin                   | Altera nome, perfil, módulos, ativo, senha, `cargo`, `registro_profissional` (CRF) e `farmaceutico` |
| GET    | /api/usuarios/farmaceuticos | receitas ou dashboard   | Farmacêuticos ativos (nome, cargo, CRF) para escolher o responsável da receita |

**Farmacêutico responsável (nada fixo no código)**: em Configurações → Usuários o admin marca "É farmacêutico" e
informa cargo e CRF (obrigatório para farmacêutico). Na receita: se o usuário logado é farmacêutico, ele assina; se
não, o único farmacêutico cadastrado é usado; com vários, o atendente escolhe o do turno (obrigatório). Sem nenhum
farmacêutico cadastrado, a ficha sai com o campo em branco (assinatura à mão). Nome, cargo e CRF são **copiados** para
a receita (`receitas.farmaceutico_*`): mudar o usuário depois não altera receitas emitidas. Relatórios exportados
trazem "Emitido por" com nome, cargo e CRF do usuário logado.

## Clientes (cadastro progressivo)

- Obrigatórios: **nome** e **telefone/WhatsApp** (10 ou 11 dígitos com DDD; gravado como `(79) 99999-9999`).
  Todo o resto é opcional: CPF (validado pelos dígitos verificadores e único **quando informado**), RG, nascimento,
  sexo, e-mail, CEP, endereço em partes (`endereco` = rua, `numero`, `complemento`, `bairro`, `cidade`, `estado`).
- `PUT /api/clientes/{id}` altera **só os campos enviados** (completar aos poucos); `null`/vazio apaga um opcional.
  CPF antigo fora do padrão não é revalidado se não mudar.
- A API devolve `cadastro_completo`, `campos_pendentes` e `endereco_completo`.
- Nas telas de Manipulação, Exames e Receitas o paciente é escolhido por busca (`src/js/seletorPaciente.js`):
  mostra o **alerta de alergia** em destaque, tem "+ Cadastrar novo cliente" (cadastro rápido por cima do pedido) e
  "Completar agora" quando faltam dados. O formulário de cliente é um só: `src/js/formCliente.js`.
- Validações iguais no backend (`app/utils.py`) e no frontend (`src/js/validacao.js`).

## Endpoints do Catálogo de Exames

| Método | Rota                              | Quem                | Descrição                                              |
|--------|-----------------------------------|---------------------|--------------------------------------------------------|
| GET    | /api/catalogo-exames?ativos=true  | quem tem o módulo   | Lista (só os disponíveis com `ativos=true`)            |
| POST   | /api/catalogo-exames              | admin               | Adiciona exame (`nome`, `valor`)                       |
| PUT    | /api/catalogo-exames/{id}         | admin               | Altera `nome`, `valor` ou `ativo` (false = remover)    |
| POST   | /api/catalogo-exames/importar     | admin               | Importa `{itens: [{nome, valor}]}`; nome existente tem o valor atualizado |

Como funciona:
- O catálogo mora no **banco** (tabela `catalogo_exames`, criada sozinha na primeira execução;
  o SQL manual está em `backend/db/`). Nunca coloque preços no código: o repositório é público.
- **Um atendimento tem vários exames** (tabela `exames` = pedido; `exame_itens` = cada exame, de 1 a 30).
  `POST /api/exames` recebe `itens: [{catalogo_id, valor?}]`: o **nome** vem sempre do catálogo (copiado); o
  **valor** vem do catálogo, mas pode ser ajustado no atendimento. O total (`exames.valor`) é calculado pelo servidor.
- `PUT /api/exames/{id}` com `itens` substitui a lista: `{id, valor?}` mantém um item já salvo (com o nome da época),
  `{catalogo_id, valor?}` inclui um novo. Sem `itens`, altera só data, pagamento e observações.
- Na tela, a busca do catálogo adiciona exames num "carrinho" (Enter ou clique), com valor editável e total na hora.
- "Remover" do catálogo apenas desativa (`ativo=false`): some da lista de escolha, o histórico fica.
- Nomes são únicos sem diferenciar maiúsculas; nomes de 1 letra são válidos (ex.: `K`).
- Na tela: **Configurações → Catálogo de Exames** (só admin). A importação lê um CSV no navegador
  (separador `;`, `,` ou tabulação; valores como `13`, `13,50` ou `R$ 1.250,00`; Excel do Windows ok).
  **Reimportar devolve os exames existentes ao valor do arquivo.**
- No modo demonstração o catálogo é uma amostra fictícia (os preços reais não ficam no site público).

## Receitas e catálogo de medicamentos

**Catálogo** (tabela `catalogo_medicamentos`: RMS, descrição, laboratório). Quem lança receitas consulta e
**cadastra** (produto recém-chegado, pelo "+ Cadastrar novo medicamento" da própria receita); editar, desativar e
importar é só do admin. A identidade de um item é o par **RMS + descrição**; cadastrar um que já existe e está ativo
responde **409** com o existente em `medicamento` (a tela usa esse). Tela: **Configurações → Catálogo de Medicamentos**.

| Método | Rota                                | Quem            | Descrição                                           |
|--------|-------------------------------------|-----------------|-----------------------------------------------------|
| GET    | /api/catalogo-medicamentos?ativos=true | quem tem o módulo | Lista (só os disponíveis com `ativos=true`)         |
| POST   | /api/catalogo-medicamentos          | admin ou receitas | Adiciona (`descricao`, `rms`?, `laboratorio`?); 409 se já existe |
| PUT    | /api/catalogo-medicamentos/{id}     | admin           | Altera campos ou `ativo` (false = remover)          |
| POST   | /api/catalogo-medicamentos/importar | admin           | Importa `{itens: [{rms, descricao, laboratorio}]}`  |

- **Importar CSV**: colunas `RMS`, `Descrição`, `Laboratório` (colunas extras como Lote/Quantidade são
  ignoradas, então a planilha de estoque serve). O RMS tem 13 dígitos e é tratado como **texto**:
  **não abra e salve o CSV no Excel** (ele converte para notação científica e apaga dígitos; a importação
  recusa essas linhas). Reimportar atualiza o laboratório de quem já existe e nunca apaga nada.
- **Receita** = cabeçalho (`receitas`: paciente, data, médico opcional, observações, farmacêutico) + itens
  (`receita_itens`). `POST /api/receitas` recebe `farmaceutico_id?` e `itens: [{catalogo_id, rms?, laboratorio?,
  dose?, posologia?, lote?, validade?, quantidade?}]` (de 1 a 12). A **descrição** vem do catálogo; **RMS e
  laboratório** também, a não ser que venham no item (correção só nesta receita, ex.: a caixa entregue é da Simed e
  não da Prati; o catálogo não muda). No `PUT`, `itens` substitui a lista; `{id}` de um item existente mantém a
  cópia original, `{catalogo_id}` troca por um do catálogo.
- **Dose e posologia são opcionais** (o nome comercial costuma trazer a dosagem: "ALPRAZOLAM 0,25 MG").
- Medicamento é sempre escolhido do catálogo; se não existe, "+ Cadastrar novo medicamento" na busca.
- **Impressão/PDF** (`src/js/pdf.js`): folha de **cheque, 175 × 80 mm** (paisagem), gerada no navegador com jsPDF
  (carregado sob demanda). Só os medicamentos lançados aparecem (sem blocos em branco), **até 3 por folha**; com
  mais, gera outras folhas, cada uma com cabeçalho e paciente. "Imprimir" abre a impressão direto (use escala 100%);
  "PDF" baixa o arquivo. Textos fixos: `EMPRESA` e `AVISO_LEGAL`; o farmacêutico vem da receita. Dose, posologia,
  médico e observações ficam salvos no sistema mas **não saem na ficha**.
- **Mudança de banco**: `receitas` perdeu a coluna `medicamentos` e ganhou `observacoes`
  (`medico_prescritor` agora é opcional), e existe a tabela nova `receita_itens`. Se o banco já tinha a
  tabela `receitas` antiga, apague-a antes (`DROP TABLE receitas;`) para a nova ser criada.

## Relatórios (Dashboard)

`GET /api/relatorios/{manipulacoes|exames|receitas}?de=&ate=&pagina=&limite=&todos=` — cada categoria isolada, com
o próprio período. `resumo` cobre o período inteiro (quantidade, clientes atendidos, faturamento, ticket médio, por
forma de pagamento, por dia, exames mais realizados / medicamentos mais dispensados); `itens` traz a página
(`limite` até 200) ou, com `todos=true`, todas as linhas (até 10 000) para exportar.

Na tela, o Dashboard tem as abas **Visão Geral · Manipulação · Exames · Receitas**. Cada aba guarda o próprio
período (mudar/limpar a data de uma não mexe nas outras), mostra métricas, gráfico, tabela paginada (20/50/100) e
exporta **PDF** (A4 paisagem) e **Excel** (.xlsx de verdade, gerado sem biblioteca em `src/js/xlsx.js`) com os
cabeçalhos da categoria. Colunas e exportação: `src/js/relatorios.js`. Há também `@media print` em
`components.css` para imprimir a tela sem menu e botões.

## Mudança de banco (feedback de novembro/2026)

Banco novo: nada a fazer (`db.create_all()` ou `backend/db/schema*.sql`). Banco que já existia: **faça backup** e
rode uma vez `backend/db/migracoes/2026-11-feedback_mysql.sql` (MySQL) ou `..._sqlserver.sql` (SQL Server). Ela torna
opcionais os campos de cliente, cria as colunas de endereço, cria `exame_itens` e converte cada exame antigo em um
pedido com 1 item, e acrescenta cargo/CRF/farmacêutico em `usuarios` e o farmacêutico em `receitas`. O script do
MySQL foi testado em MariaDB 10.11; o do SQL Server ainda não foi executado num servidor real.
Depois, marque em Configurações → Usuários quem é farmacêutico (com o CRF).

## Editar e excluir registros

Clientes, manipulações, exames e receitas têm `PUT` e `DELETE` na API e botões de editar/excluir
na tela. O paciente de um registro não pode ser trocado. Cliente com manipulações, exames ou
receitas vinculados não pode ser excluído.
