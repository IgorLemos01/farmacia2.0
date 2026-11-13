-- =============================================================
--  FARMÁCIA COUTO — MIGRAÇÃO (SQL Server) — ajustes do feedback de novembro/2026
--
--  Para bancos criados ANTES desta versão. Banco novo não precisa: as tabelas
--  já nascem certas (db.create_all() ou db/schema_sqlserver.sql).
--
--  >>> FAÇA UM BACKUP ANTES (SSMS: botão direito no banco → Tasks → Back Up...) <<<
--  Rode UMA vez no SSMS, com a API parada. Se alguma etapa der erro, restaure o backup,
--  corrija o problema e rode de novo. Funciona tanto para o banco criado pelo
--  schema_sqlserver.sql quanto pelo db.create_all() (nomes de índices diferentes).
--
--  O que muda:
--   1. usuarios: cargo, registro profissional (CRF) e marca de farmacêutico.
--   2. clientes: só nome e telefone obrigatórios; endereço em partes; CPF único só quando informado.
--   3. exames: um pedido com vários exames (tabela nova exame_itens). Cada exame antigo
--      vira um pedido com 1 item, sem perder nome nem valor.
--   4. receitas: farmacêutico responsável gravado em cada receita.
-- =============================================================

USE farmacia_couto;
GO

-- 1. USUARIOS -------------------------------------------------
ALTER TABLE usuarios ADD
    cargo                 NVARCHAR(80) NULL,
    registro_profissional NVARCHAR(40) NULL,
    farmaceutico          BIT          NOT NULL CONSTRAINT df_usuarios_farmaceutico DEFAULT 0;

-- 2. CLIENTES -------------------------------------------------
-- 2.1 Remove índices/constraints que prendem as colunas que ficarão opcionais
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += CASE WHEN i.is_unique_constraint = 1
                    THEN N'ALTER TABLE clientes DROP CONSTRAINT ' + QUOTENAME(i.name) + N';'
                    ELSE N'DROP INDEX ' + QUOTENAME(i.name) + N' ON clientes;' END
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'clientes') AND i.is_primary_key = 0
  AND c.name IN (N'cpf', N'rg', N'data_nascimento', N'sexo', N'email', N'endereco')
GROUP BY i.name, i.is_unique_constraint;
SELECT @sql += N'ALTER TABLE clientes DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID(N'clientes') AND c.name = N'sexo';
EXEC sp_executesql @sql;

-- 2.2 Campos opcionais
ALTER TABLE clientes ALTER COLUMN cpf             NVARCHAR(14)  NULL;
ALTER TABLE clientes ALTER COLUMN rg              NVARCHAR(20)  NULL;
ALTER TABLE clientes ALTER COLUMN data_nascimento DATE          NULL;
ALTER TABLE clientes ALTER COLUMN sexo            NVARCHAR(10)  NULL;
ALTER TABLE clientes ALTER COLUMN email           NVARCHAR(150) NULL;
ALTER TABLE clientes ALTER COLUMN endereco        NVARCHAR(300) NULL;
ALTER TABLE clientes ADD
    cep         NVARCHAR(9)   NULL,
    numero      NVARCHAR(20)  NULL,
    complemento NVARCHAR(100) NULL,
    bairro      NVARCHAR(100) NULL,
    cidade      NVARCHAR(100) NULL,
    estado      NCHAR(2)      NULL;

UPDATE clientes SET cpf = NULL      WHERE cpf IS NOT NULL AND LTRIM(RTRIM(cpf)) = '';
UPDATE clientes SET rg = NULL       WHERE rg IS NOT NULL AND LTRIM(RTRIM(rg)) = '';
UPDATE clientes SET email = NULL    WHERE email IS NOT NULL AND LTRIM(RTRIM(email)) = '';
UPDATE clientes SET endereco = NULL WHERE endereco IS NOT NULL AND LTRIM(RTRIM(endereco)) = '';

ALTER TABLE clientes ADD CONSTRAINT chk_clientes_sexo CHECK (sexo IS NULL OR sexo IN ('M', 'F', 'Outro'));
GO

-- índice único FILTRADO: vários clientes podem ficar sem CPF (o SQL Server só aceita 1 NULL num UNIQUE comum)
CREATE UNIQUE NONCLUSTERED INDEX uq_clientes_cpf ON clientes(cpf) WHERE cpf IS NOT NULL;

-- 3. EXAMES ---------------------------------------------------
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
END;

-- cada exame antigo vira um pedido com 1 item (mesmo nome e valor)
EXEC sp_executesql N'
INSERT INTO exame_itens (exame_id, ordem, catalogo_id, nome, valor)
SELECT e.id, 1,
       (SELECT TOP 1 c.id FROM catalogo_exames c WHERE c.nome = e.tipo_exame),
       e.tipo_exame, COALESCE(e.valor, 0)
FROM exames e
WHERE NOT EXISTS (SELECT 1 FROM exame_itens i WHERE i.exame_id = e.id);';

UPDATE exames SET valor = 0 WHERE valor IS NULL;
ALTER TABLE exames DROP COLUMN tipo_exame;
CREATE NONCLUSTERED INDEX idx_exames_data ON exames(data);

-- 4. RECEITAS -------------------------------------------------
ALTER TABLE receitas ADD
    farmaceutico_id       INT           NULL,
    farmaceutico_nome     NVARCHAR(120) NULL,
    farmaceutico_cargo    NVARCHAR(80)  NULL,
    farmaceutico_registro NVARCHAR(40)  NULL;
GO
ALTER TABLE receitas ADD CONSTRAINT fk_receitas_farmaceutico FOREIGN KEY (farmaceutico_id) REFERENCES usuarios(id);

GO

-- OPCIONAL: as receitas antigas eram impressas com o farmacêutico fixo no código.
-- Para que continuem saindo com ele, preencha e descomente (troque os dados reais):
-- UPDATE receitas
--    SET farmaceutico_nome = N'NOME DO FARMACÊUTICO', farmaceutico_registro = N'CRF-SE 0000'
--  WHERE farmaceutico_nome IS NULL;

-- Depois: em Configurações → Usuários, marque "É farmacêutico" e informe o CRF de quem assina as receitas.
PRINT 'Migração concluída.';
