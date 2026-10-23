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
-- 1. USUARIOS — Funcionários/atendentes do sistema
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id          INT             NOT NULL AUTO_INCREMENT,
    nome        VARCHAR(120)    NOT NULL,
    email       VARCHAR(120)    NOT NULL,
    senha_hash  VARCHAR(255)    NOT NULL,
    perfil      ENUM('admin', 'atendente') NOT NULL DEFAULT 'atendente',
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
-- 5. RECEITAS — Receitas médicas vinculadas a clientes
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receitas (
    id                  INT          NOT NULL AUTO_INCREMENT,
    cliente_id          INT          NOT NULL,

    data_venda          DATE         NOT NULL DEFAULT (CURRENT_DATE),
    medico_prescritor   VARCHAR(200) NOT NULL,
    medicamentos        TEXT         NOT NULL COMMENT 'Lista/descrição dos medicamentos prescritos',
    criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_receitas_cliente (cliente_id),
    CONSTRAINT fk_receitas_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
