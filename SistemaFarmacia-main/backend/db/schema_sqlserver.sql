-- =============================================================
--  FARMÁCIA COUTO — SCRIPT T-SQL PARA O SQL SERVER (SSMS)
--  Compatível com SQL Server 2016, 2019, 2022+ e SSMS 22
--  Banco já existente (versão anterior)? Use db/migracoes/2026-11-feedback_sqlserver.sql
-- =============================================================

-- 1. Criação do Banco de Dados
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'farmacia_couto')
BEGIN
    CREATE DATABASE farmacia_couto;
END
GO

USE farmacia_couto;
GO

-- -------------------------------------------------------------
-- 2. Tabela USUARIOS
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'usuarios')
BEGIN
    CREATE TABLE usuarios (
        id          INT IDENTITY(1,1)   NOT NULL,
        nome        NVARCHAR(120)       NOT NULL,
        email       NVARCHAR(120)       NOT NULL,
        senha_hash  NVARCHAR(255)       NOT NULL,
        perfil      NVARCHAR(20)        NOT NULL DEFAULT 'funcionario',
        modulos     NVARCHAR(200)       NOT NULL DEFAULT '',   -- ex.: 'clientes,receitas' (o admin acessa todos)
        ativo       BIT                 NOT NULL DEFAULT 1,
        cargo                 NVARCHAR(80)  NULL,          -- ex.: 'Farmacêutico Responsável'
        registro_profissional NVARCHAR(40)  NULL,          -- ex.: 'CRF-SE 1234'
        farmaceutico          BIT           NOT NULL DEFAULT 0,  -- 1 = pode ser o responsável das receitas
        criado_em   DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_usuarios PRIMARY KEY (id),
        CONSTRAINT uq_usuarios_email UNIQUE (email),
        CONSTRAINT chk_usuarios_perfil CHECK (perfil IN ('admin', 'funcionario'))
    );
END
GO

-- -------------------------------------------------------------
-- 3. Tabela CLIENTES — cadastro progressivo: só nome e telefone são obrigatórios.
--    CPF é único quando informado (índice único FILTRADO: vários clientes podem ficar sem CPF).
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'clientes')
BEGIN
    CREATE TABLE clientes (
        id               INT IDENTITY(1,1)   NOT NULL,

        -- Obrigatórios
        nome             NVARCHAR(150)       NOT NULL,
        telefone         NVARCHAR(20)        NOT NULL,   -- WhatsApp / telefone principal

        -- Opcionais
        cpf              NVARCHAR(14)        NULL,
        rg               NVARCHAR(20)        NULL,
        data_nascimento  DATE                NULL,
        sexo             NVARCHAR(10)        NULL,
        email            NVARCHAR(150)       NULL,
        cep              NVARCHAR(9)         NULL,
        endereco         NVARCHAR(300)       NULL,       -- rua / logradouro
        numero           NVARCHAR(20)        NULL,
        complemento      NVARCHAR(100)       NULL,
        bairro           NVARCHAR(100)       NULL,
        cidade           NVARCHAR(100)       NULL,
        estado           NCHAR(2)            NULL,
        alergia          NVARCHAR(MAX)       NULL,
        observacoes      NVARCHAR(MAX)       NULL,

        criado_em        DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_clientes PRIMARY KEY (id),
        CONSTRAINT chk_clientes_sexo CHECK (sexo IS NULL OR sexo IN ('M', 'F', 'Outro'))
    );

    CREATE NONCLUSTERED INDEX idx_clientes_nome ON clientes(nome);
    CREATE UNIQUE NONCLUSTERED INDEX uq_clientes_cpf ON clientes(cpf) WHERE cpf IS NOT NULL;
END
GO

-- -------------------------------------------------------------
-- 4. Tabela MANIPULACOES
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'manipulacoes')
BEGIN
    CREATE TABLE manipulacoes (
        id              INT IDENTITY(1,1)   NOT NULL,
        cliente_id      INT                 NOT NULL,
        data            DATE                NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        formula         NVARCHAR(MAX)       NOT NULL,
        prazo_entrega   DATE                NULL,
        valor           DECIMAL(10, 2)      NULL,
        forma_pagamento NVARCHAR(50)        NULL,
        observacoes     NVARCHAR(MAX)       NULL,
        criado_em       DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_manipulacoes PRIMARY KEY (id),
        CONSTRAINT fk_manipulacoes_cliente FOREIGN KEY (cliente_id) 
            REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE NO ACTION
    );

    CREATE NONCLUSTERED INDEX idx_manipulacoes_cliente ON manipulacoes(cliente_id);
END
GO

-- -------------------------------------------------------------
-- 5. Tabela EXAMES — pedido de exames de um atendimento (vários exames por visita).
--    `valor` = total do pedido (soma de EXAME_ITENS).
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'exames')
BEGIN
    CREATE TABLE exames (
        id              INT IDENTITY(1,1)   NOT NULL,
        cliente_id      INT                 NOT NULL,
        data            DATE                NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        valor           DECIMAL(10, 2)      NULL,
        forma_pagamento NVARCHAR(50)        NULL,
        observacoes     NVARCHAR(MAX)       NULL,
        criado_em       DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_exames PRIMARY KEY (id),
        CONSTRAINT fk_exames_cliente FOREIGN KEY (cliente_id) 
            REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE NO ACTION
    );

    CREATE NONCLUSTERED INDEX idx_exames_cliente ON exames(cliente_id);
    CREATE NONCLUSTERED INDEX idx_exames_data ON exames(data);
END
GO

-- -------------------------------------------------------------
-- 5.1 Tabela EXAME_ITENS — cada exame do pedido (nome copiado do catálogo; valor ajustável)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'exame_itens')
BEGIN
    CREATE TABLE exame_itens (
        id              INT IDENTITY(1,1)   NOT NULL,
        exame_id        INT                 NOT NULL,
        ordem           INT                 NOT NULL DEFAULT 0,
        catalogo_id     INT                 NULL,
        nome            NVARCHAR(200)       NOT NULL,
        valor           DECIMAL(10, 2)      NOT NULL DEFAULT 0,

        CONSTRAINT pk_exame_itens PRIMARY KEY (id),
        CONSTRAINT fk_exame_itens_exame FOREIGN KEY (exame_id)
            REFERENCES exames(id) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX idx_exame_itens_exame ON exame_itens(exame_id);
END
GO

-- -------------------------------------------------------------
-- 6. Tabela RECEITAS (cabeçalho da receita; os medicamentos ficam em RECEITA_ITENS)
--    Se você já criou uma versão antiga desta tabela (com a coluna "medicamentos"),
--    apague-a antes de rodar este script:  DROP TABLE receitas;
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'receitas')
BEGIN
    CREATE TABLE receitas (
        id                  INT IDENTITY(1,1)   NOT NULL,
        cliente_id          INT                 NOT NULL,
        data_venda          DATE                NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        medico_prescritor   NVARCHAR(200)       NULL,
        observacoes         NVARCHAR(MAX)       NULL,
        -- Farmacêutico responsável: cópia do usuário no momento da receita
        farmaceutico_id       INT               NULL,
        farmaceutico_nome     NVARCHAR(120)     NULL,
        farmaceutico_cargo    NVARCHAR(80)      NULL,
        farmaceutico_registro NVARCHAR(40)      NULL,
        criado_em           DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_receitas PRIMARY KEY (id),
        CONSTRAINT fk_receitas_farmaceutico FOREIGN KEY (farmaceutico_id) REFERENCES usuarios(id),
        CONSTRAINT fk_receitas_cliente FOREIGN KEY (cliente_id) 
            REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE NO ACTION
    );

    CREATE NONCLUSTERED INDEX idx_receitas_cliente ON receitas(cliente_id);
END
GO

-- -------------------------------------------------------------
-- 6.1 Tabela RECEITA_ITENS (medicamentos de cada receita)
--     RMS, medicamento e laboratório são uma CÓPIA do catálogo no momento da
--     receita: alterar o catálogo depois não muda receitas já emitidas.
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'receita_itens')
BEGIN
    CREATE TABLE receita_itens (
        id              INT IDENTITY(1,1)   NOT NULL,
        receita_id      INT                 NOT NULL,
        ordem           INT                 NOT NULL DEFAULT 0,
        medicamento     NVARCHAR(255)       NOT NULL,
        rms             NVARCHAR(30)        NOT NULL DEFAULT '',
        laboratorio     NVARCHAR(150)       NULL,
        dose            NVARCHAR(60)        NULL,
        posologia       NVARCHAR(200)       NULL,
        lote            NVARCHAR(60)        NULL,
        validade        NVARCHAR(20)        NULL,
        quantidade      INT                 NULL,

        CONSTRAINT pk_receita_itens PRIMARY KEY (id),
        CONSTRAINT fk_receita_itens_receita FOREIGN KEY (receita_id)
            REFERENCES receitas(id) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX idx_receita_itens_receita ON receita_itens(receita_id);
END
GO

-- -------------------------------------------------------------
-- 7. Tabela CATALOGO_EXAMES (nome e valor dos exames oferecidos)
--    O registro em EXAMES guarda uma cópia do nome e do valor, então
--    mudar o preço aqui não altera exames já realizados.
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'catalogo_exames')
BEGIN
    CREATE TABLE catalogo_exames (
        id              INT IDENTITY(1,1)   NOT NULL,
        nome            NVARCHAR(200)       NOT NULL,
        valor           DECIMAL(10, 2)      NOT NULL,
        ativo           BIT                 NOT NULL DEFAULT 1,
        criado_em       DATETIME            NOT NULL DEFAULT GETDATE(),
        atualizado_em   DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_catalogo_exames PRIMARY KEY (id),
        CONSTRAINT uq_catalogo_exames_nome UNIQUE (nome)
    );
END
GO

-- -------------------------------------------------------------
-- 8. Tabela CATALOGO_MEDICAMENTOS (RMS, descrição e laboratório)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'catalogo_medicamentos')
BEGIN
    CREATE TABLE catalogo_medicamentos (
        id              INT IDENTITY(1,1)   NOT NULL,
        rms             NVARCHAR(30)        NOT NULL DEFAULT '',
        descricao       NVARCHAR(255)       NOT NULL,
        laboratorio     NVARCHAR(150)       NULL,
        ativo           BIT                 NOT NULL DEFAULT 1,
        criado_em       DATETIME            NOT NULL DEFAULT GETDATE(),
        atualizado_em   DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT pk_catalogo_medicamentos PRIMARY KEY (id),
        CONSTRAINT uq_catalogo_medicamentos_rms_descricao UNIQUE (rms, descricao)
    );

    CREATE NONCLUSTERED INDEX idx_catalogo_medicamentos_rms ON catalogo_medicamentos(rms);
END
GO

PRINT 'Banco de dados farmacia_couto e tabelas criadas com sucesso no SQL Server!';
