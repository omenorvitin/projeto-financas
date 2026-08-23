-- ==========================================
-- SCHEMA DO BANCO "financas" (MySQL)
-- ==========================================
-- Esse arquivo cria o banco e as tabelas que o BackEnd/server.js
-- espera encontrar. Sem isso, todo INSERT/SELECT feito pelo servidor
-- falha (é a causa do "Erro ao cadastrar" na tela de cadastro).
--
-- Como rodar:
--   1) Abra o terminal do MySQL:
--        mysql -u root -p
--      (a senha é a mesma do DB_PASSWORD no .env, hoje "0000")
--   2) Rode este arquivo:
--        source caminho/para/schema.sql;
--      ou, sem entrar no terminal do MySQL:
--        mysql -u root -p < schema.sql
-- ==========================================

CREATE DATABASE IF NOT EXISTS financas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE financas;

-- ------------------------------------------
-- Tabela: cadastro (usuários)
-- ------------------------------------------
-- Colunas usadas pelo server.js:
--   INSERIR_USUARIO: nome, cpf, email, senha_hash, aceitou_termos, data_aceite
--   BUSCAR_USUARIO_LOGIN: email, status
CREATE TABLE IF NOT EXISTS cadastro (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nome            VARCHAR(150)  NOT NULL,
    cpf             VARCHAR(11)   NOT NULL UNIQUE,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    senha_hash      VARCHAR(255)  NOT NULL,      -- hash gerado pelo bcrypt, nunca a senha em texto puro
    aceitou_termos  TINYINT(1)    NOT NULL DEFAULT 0,
    data_aceite     DATETIME      NULL,           -- data em que aceitou os termos (LGPD)
    status          VARCHAR(20)   NOT NULL DEFAULT 'ativo',  -- 'ativo' | 'inativo' (login só busca status='ativo')
    data_cadastro   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------
-- Tabela: corrente (contas correntes)
-- ------------------------------------------
-- Colunas usadas pelo server.js:
--   INSERIR_CONTA_CORRENTE: usuario_id, saldo, pix, cartoes, faturas, rendimentos, tipo_conta
--   BUSCAR_CONTA_CORRENTE: faz JOIN com cadastro por usuario_id
CREATE TABLE IF NOT EXISTS corrente (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id      INT           NOT NULL,
    saldo           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pix             VARCHAR(150)  NULL,
    cartoes         JSON          NULL,           -- lista de cartões, salva como JSON (server.js faz JSON.stringify antes de inserir)
    faturas         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    rendimentos     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tipo_conta      VARCHAR(20)   NOT NULL DEFAULT 'corrente',
    data_cadastro   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Se o usuário for apagado, suas contas correntes vão junto
    CONSTRAINT fk_corrente_usuario
        FOREIGN KEY (usuario_id) REFERENCES cadastro(id)
        ON DELETE CASCADE
);

-- ------------------------------------------
-- Tabela: poupanca (contas poupança)
-- ------------------------------------------
-- Colunas usadas pelo server.js:
--   INSERIR_CONTA_POUPANCA: usuario_id, saldo, taxa_rendimento, tipo_conta
--   BUSCAR_CONTA_POUPANCA: faz JOIN com cadastro por usuario_id
--   ATUALIZAR_CONTA_POUPANCA: saldo, taxa_rendimento (por id)
CREATE TABLE IF NOT EXISTS poupanca (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id       INT           NOT NULL,
    saldo            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    taxa_rendimento  DECIMAL(5,2)  NOT NULL DEFAULT 0.50,  -- % ao mês
    tipo_conta       VARCHAR(20)   NOT NULL DEFAULT 'poupanca',
    data_cadastro    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_poupanca_usuario
        FOREIGN KEY (usuario_id) REFERENCES cadastro(id)
        ON DELETE CASCADE
);

-- ------------------------------------------
-- Tabela: transacoes (receitas e despesas)
-- ------------------------------------------
-- Colunas usadas pelo server.js:
--   INSERIR_TRANSACAO: usuario_id, tipo, categoria, descricao, valor, data
--   LISTAR_TRANSACOES: usuario_id (filtro), ordenado por data
CREATE TABLE IF NOT EXISTS transacoes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id      INT           NOT NULL,
    tipo            ENUM('receita', 'despesa') NOT NULL,
    categoria       VARCHAR(50)   NOT NULL,
    descricao       VARCHAR(255)  NOT NULL,
    valor           DECIMAL(12,2) NOT NULL,
    data            DATE          NOT NULL,
    criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transacoes_usuario
        FOREIGN KEY (usuario_id) REFERENCES cadastro(id)
        ON DELETE CASCADE
);

-- ------------------------------------------
-- Tabela: dados_financeiros (estado do dashboard rico - index.html)
-- ------------------------------------------
-- O dashboard de index.html (BackEnd/script.js) guarda TODO o seu estado
-- (contas, categorias, transações, orçamentos, metas, config) como um único
-- blob JSON por usuário, lido/gravado pelas rotas GET/POST/DELETE /api/data.
CREATE TABLE IF NOT EXISTS dados_financeiros (
    usuario_id      INT           NOT NULL PRIMARY KEY,
    dados           JSON          NOT NULL,
    atualizado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dados_financeiros_usuario
        FOREIGN KEY (usuario_id) REFERENCES cadastro(id)
        ON DELETE CASCADE
);
