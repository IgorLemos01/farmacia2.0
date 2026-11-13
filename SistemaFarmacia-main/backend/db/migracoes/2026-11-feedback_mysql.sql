-- =============================================================
--  FARMÁCIA COUTO — MIGRAÇÃO (MySQL) — ajustes do feedback de novembro/2026
--
--  Para bancos criados ANTES desta versão. Banco novo não precisa: as tabelas
--  já nascem certas (db.create_all() ou db/schema.sql).
--
--  >>> FAÇA UM BACKUP ANTES (mysqldump farmacia_couto > backup.sql) <<<
--  Rode UMA vez, com a API parada:  mysql -u usuario -p farmacia_couto < 2026-11-feedback_mysql.sql
--
--  O que muda:
--   1. usuarios: cargo, registro profissional (CRF) e marca de farmacêutico.
--   2. clientes: só nome e telefone obrigatórios; endereço em partes (CEP, número, bairro...).
--   3. exames: um pedido com vários exames (tabela nova exame_itens). Cada exame antigo
--      vira um pedido com 1 item, sem perder nome nem valor.
--   4. receitas: farmacêutico responsável gravado em cada receita.
-- =============================================================

USE farmacia_couto;

-- 1. USUARIOS -------------------------------------------------
ALTER TABLE usuarios
    ADD COLUMN cargo                 VARCHAR(80) NULL,
    ADD COLUMN registro_profissional VARCHAR(40) NULL,
    ADD COLUMN farmaceutico          TINYINT(1)  NOT NULL DEFAULT 0;

-- 2. CLIENTES -------------------------------------------------
ALTER TABLE clientes
    MODIFY cpf             VARCHAR(14)  NULL,
    MODIFY rg              VARCHAR(20)  NULL,
    MODIFY data_nascimento DATE         NULL,
    MODIFY sexo            VARCHAR(10)  NULL,
    MODIFY email           VARCHAR(150) NULL,
    MODIFY endereco        VARCHAR(300) NULL,
    ADD COLUMN cep         VARCHAR(9)   NULL,
    ADD COLUMN numero      VARCHAR(20)  NULL,
    ADD COLUMN complemento VARCHAR(100) NULL,
    ADD COLUMN bairro      VARCHAR(100) NULL,
    ADD COLUMN cidade      VARCHAR(100) NULL,
    ADD COLUMN estado      CHAR(2)      NULL;

-- textos vazios viram "não informado" (NULL); o índice único de CPF aceita vários NULL
UPDATE clientes SET cpf = NULL      WHERE cpf IS NOT NULL AND TRIM(cpf) = '';
UPDATE clientes SET rg = NULL       WHERE rg IS NOT NULL AND TRIM(rg) = '';
UPDATE clientes SET email = NULL    WHERE email IS NOT NULL AND TRIM(email) = '';
UPDATE clientes SET endereco = NULL WHERE endereco IS NOT NULL AND TRIM(endereco) = '';

-- 3. EXAMES ---------------------------------------------------
CREATE TABLE IF NOT EXISTS exame_itens (
    id              INT             NOT NULL AUTO_INCREMENT,
    exame_id        INT             NOT NULL,
    ordem           INT             NOT NULL DEFAULT 0,
    catalogo_id     INT             NULL,
    nome            VARCHAR(200)    NOT NULL,
    valor           DECIMAL(10, 2)  NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_exame_itens_exame (exame_id),
    CONSTRAINT fk_exame_itens_exame
        FOREIGN KEY (exame_id) REFERENCES exames (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- cada exame antigo vira um pedido com 1 item (mesmo nome e valor)
INSERT INTO exame_itens (exame_id, ordem, catalogo_id, nome, valor)
SELECT e.id, 1,
       (SELECT c.id FROM catalogo_exames c WHERE c.nome = e.tipo_exame LIMIT 1),
       e.tipo_exame, COALESCE(e.valor, 0)
FROM exames e
WHERE NOT EXISTS (SELECT 1 FROM exame_itens i WHERE i.exame_id = e.id);

UPDATE exames SET valor = 0 WHERE valor IS NULL;
ALTER TABLE exames DROP COLUMN tipo_exame;
CREATE INDEX idx_exames_data ON exames (data);

-- 4. RECEITAS -------------------------------------------------
ALTER TABLE receitas
    ADD COLUMN farmaceutico_id       INT          NULL,
    ADD COLUMN farmaceutico_nome     VARCHAR(120) NULL,
    ADD COLUMN farmaceutico_cargo    VARCHAR(80)  NULL,
    ADD COLUMN farmaceutico_registro VARCHAR(40)  NULL,
    ADD CONSTRAINT fk_receitas_farmaceutico FOREIGN KEY (farmaceutico_id) REFERENCES usuarios (id);

-- OPCIONAL: as receitas antigas eram impressas com o farmacêutico fixo no código.
-- Para que continuem saindo com ele, preencha e descomente (troque os dados reais):
-- UPDATE receitas
--    SET farmaceutico_nome = 'NOME DO FARMACÊUTICO', farmaceutico_registro = 'CRF-SE 0000'
--  WHERE farmaceutico_nome IS NULL;

-- Depois: em Configurações → Usuários, marque "É farmacêutico" e informe o CRF de quem assina as receitas.
