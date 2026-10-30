-- =============================================================
--  FARMÁCIA COUTO — Script de criação das tabelas no MySQL
--  Gerado em: 2026-10-23
--
--  Ordem de criação respeita as dependências (FK):
--    1. usuarios
--    2. clientes
--    3. manipulacoes   (depende de clientes)
--    4. exames         (depende de clientes)
--    5. receitas       (depende de clientes)
-- =============================================================

-- Cria o banco caso ainda não exista
CREATE DATABASE IF NOT EXISTS farmacia_couto
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE farmacia_couto;

-- -------------------------------------------------------------
-- 1. USUARIOS — Administradores e funcionários do sistema
--    `modulos` guarda os módulos liberados ao funcionário (ex.: 'clientes,receitas'); o admin acessa todos.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id          INT             NOT NULL AUTO_INCREMENT,
    nome        VARCHAR(120)    NOT NULL,
    email       VARCHAR(120)    NOT NULL,
    senha_hash  VARCHAR(255)    NOT NULL,
    perfil      ENUM('admin', 'funcionario') NOT NULL DEFAULT 'funcionario',
    modulos     VARCHAR(200)    NOT NULL DEFAULT '',
    ativo       TINYINT(1)      NOT NULL DEFAULT 1,
    criado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 2. CLIENTES — Cadastro de clientes da farmácia
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id               INT          NOT NULL AUTO_INCREMENT,

    -- Campos obrigatórios (NOT NULL)
    nome             VARCHAR(150) NOT NULL,
    cpf              VARCHAR(14)  NOT NULL COMMENT 'Formato: 000.000.000-00',
    rg               VARCHAR(20)  NOT NULL,
    data_nascimento  DATE         NOT NULL,
    sexo             ENUM('M', 'F', 'Outro') NOT NULL,
    telefone         VARCHAR(20)  NOT NULL,
    email            VARCHAR(150) NOT NULL,
    endereco         VARCHAR(300) NOT NULL,

    -- Campos opcionais
    alergia          TEXT         NULL COMMENT 'Alergias conhecidas do cliente',
    observacoes      TEXT         NULL,

    criado_em        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_clientes_cpf (cpf),
    INDEX idx_clientes_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 3. MANIPULACOES — Pedidos de manipulação de medicamentos
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manipulacoes (
    id              INT             NOT NULL AUTO_INCREMENT,
    cliente_id      INT             NOT NULL,

    data            DATE            NOT NULL DEFAULT (CURRENT_DATE),
    formula         TEXT            NOT NULL COMMENT 'Fórmula / composição do medicamento',
    prazo_entrega   DATE            NULL     COMMENT 'Data prevista de entrega',
    valor           DECIMAL(10, 2)  NULL,
    forma_pagamento ENUM(
                        'Dinheiro',
                        'Cartão de Crédito',
                        'Cartão de Débito',
                        'PIX',
                        'Outro'
                    )               NULL,
    observacoes     TEXT            NULL,
    criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_manipulacoes_cliente (cliente_id),
    CONSTRAINT fk_manipulacoes_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 4. EXAMES — Exames realizados para clientes
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exames (
    id              INT             NOT NULL AUTO_INCREMENT,
    cliente_id      INT             NOT NULL,

    tipo_exame      VARCHAR(200)    NOT NULL,
    data            DATE            NOT NULL DEFAULT (CURRENT_DATE),
    valor           DECIMAL(10, 2)  NULL,
    forma_pagamento ENUM(
                        'Dinheiro',
                        'Cartão de Crédito',
                        'Cartão de Débito',
                        'PIX',
                        'Outro'
                    )               NULL,
    observacoes     TEXT            NULL,
    criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_exames_cliente (cliente_id),
    CONSTRAINT fk_exames_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 5. RECEITAS — Cabeçalho da receita (os medicamentos ficam em RECEITA_ITENS)
--    Se você já criou uma versão antiga desta tabela (com a coluna "medicamentos"),
--    apague-a antes de rodar este script:  DROP TABLE receitas;
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receitas (
    id                  INT          NOT NULL AUTO_INCREMENT,
    cliente_id          INT          NOT NULL,

    data_venda          DATE         NOT NULL DEFAULT (CURRENT_DATE),
    medico_prescritor   VARCHAR(200) NULL,
    observacoes         TEXT         NULL,
    criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_receitas_cliente (cliente_id),
    CONSTRAINT fk_receitas_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 5.1 RECEITA_ITENS — Medicamentos de cada receita
--     RMS, medicamento e laboratório são uma CÓPIA do catálogo no momento da
--     receita: alterar o catálogo depois não muda receitas já emitidas.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receita_itens (
    id              INT          NOT NULL AUTO_INCREMENT,
    receita_id      INT          NOT NULL,
    ordem           INT          NOT NULL DEFAULT 0,
    medicamento     VARCHAR(255) NOT NULL,
    rms             VARCHAR(30)  NOT NULL DEFAULT '',
    laboratorio     VARCHAR(150) NULL,
    dose            VARCHAR(60)  NULL,
    posologia       VARCHAR(200) NULL,
    lote            VARCHAR(60)  NULL,
    validade        VARCHAR(20)  NULL,
    quantidade      INT          NULL,

    PRIMARY KEY (id),
    INDEX idx_receita_itens_receita (receita_id),
    CONSTRAINT fk_receita_itens_receita
        FOREIGN KEY (receita_id) REFERENCES receitas (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 6. CATALOGO_EXAMES — Nome e valor dos exames oferecidos
--    O registro em EXAMES guarda uma cópia do nome e do valor, então
--    mudar o preço aqui não altera exames já realizados.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_exames (
    id              INT             NOT NULL AUTO_INCREMENT,
    nome            VARCHAR(200)    NOT NULL,
    valor           DECIMAL(10, 2)  NOT NULL,
    ativo           TINYINT(1)      NOT NULL DEFAULT 1,
    criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_catalogo_exames_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 7. CATALOGO_MEDICAMENTOS — RMS, descrição e laboratório
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_medicamentos (
    id              INT             NOT NULL AUTO_INCREMENT,
    rms             VARCHAR(30)     NOT NULL DEFAULT '',
    descricao       VARCHAR(255)    NOT NULL,
    laboratorio     VARCHAR(150)    NULL,
    ativo           TINYINT(1)      NOT NULL DEFAULT 1,
    criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_catalogo_medicamentos_rms_descricao (rms, descricao),
    INDEX idx_catalogo_medicamentos_rms (rms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
