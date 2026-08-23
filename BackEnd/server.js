// ==========================================
// DEPENDÊNCIAS E CONFIGURAÇÕES
// ==========================================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');

// Inicializa a aplicação Express
const app = express();

// Middlewares: Parse JSON e habilitação de CORS
app.use(express.json());
app.use(cors());

// Serve os arquivos do frontend (login.html, dashboard.html, index.html,
// FrontEnd/style.css, BackEnd/script.js) direto pela raiz do projeto.
// Assim dá pra acessar tudo por http://localhost:3000/login.html
// em vez de precisar abrir os arquivos manualmente.
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

// ==========================================
// CONSTANTES E CONFIGURAÇÕES
// ==========================================
const SALT_ROUNDS = 10; // Número de rounds para bcrypt (quanto maior, mais seguro mas mais lento)
const PORT = process.env.PORT || 3000;

// Queries SQL preparadas (evita repetição e facilita manutenção)
const QUERIES = {
    INSERIR_USUARIO: `INSERT INTO cadastro (nome, cpf, email, senha_hash, aceitou_termos, data_aceite) 
                      VALUES (?, ?, ?, ?, ?, ?)`,
    BUSCAR_USUARIO_LOGIN: 'SELECT * FROM cadastro WHERE email = ? AND status = \'ativo\'',
    INSERIR_CONTA_CORRENTE: `INSERT INTO corrente (usuario_id, saldo, pix, cartoes, faturas, rendimentos, tipo_conta) 
                             VALUES (?, ?, ?, ?, ?, ?, 'corrente')`,
    BUSCAR_CONTA_CORRENTE: `SELECT c.id AS conta_id, u.nome, u.cpf, c.saldo, c.pix, c.cartoes, c.faturas, c.rendimentos, c.data_cadastro
                            FROM corrente c
                            JOIN cadastro u ON c.usuario_id = u.id
                            WHERE c.usuario_id = ?`,
    INSERIR_CONTA_POUPANCA: `INSERT INTO poupanca (usuario_id, saldo, taxa_rendimento, tipo_conta) 
                             VALUES (?, ?, ?, 'poupanca')`,
    BUSCAR_CONTA_POUPANCA: `SELECT p.id AS conta_id, u.nome, u.cpf, p.saldo, p.taxa_rendimento, p.data_cadastro
                            FROM poupanca p
                            JOIN cadastro u ON p.usuario_id = u.id
                            WHERE p.usuario_id = ?`,
    ATUALIZAR_CONTA_POUPANCA: `UPDATE poupanca SET saldo = ?, taxa_rendimento = ? WHERE id = ?`,
    DELETAR_CONTA_POUPANCA: `DELETE FROM poupanca WHERE id = ?`,
    INSERIR_TRANSACAO: `INSERT INTO transacoes (usuario_id, tipo, categoria, descricao, valor, data)
                        VALUES (?, ?, ?, ?, ?, ?)`,
    LISTAR_TRANSACOES: `SELECT id, tipo, categoria, descricao, valor, data
                        FROM transacoes WHERE usuario_id = ? ORDER BY data DESC, id DESC`,
    ATUALIZAR_SALDO_CORRENTE: `UPDATE corrente SET saldo = saldo + ? WHERE usuario_id = ?`,
    DELETAR_USUARIO: `DELETE FROM cadastro WHERE id = ?`,  // contas/transações somem junto (ON DELETE CASCADE)
    BUSCAR_DADOS_FINANCEIROS: `SELECT dados FROM dados_financeiros WHERE usuario_id = ?`,
    SALVAR_DADOS_FINANCEIROS: `INSERT INTO dados_financeiros (usuario_id, dados) VALUES (?, ?)
                               ON DUPLICATE KEY UPDATE dados = VALUES(dados)`,
    DELETAR_DADOS_FINANCEIROS: `DELETE FROM dados_financeiros WHERE usuario_id = ?`
};

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Valida se todos os campos obrigatórios estão preenchidos
 * @param {Object} campos - Objeto contendo os campos a validar
 * @param {Array<string>} nomes - Lista com nomes dos campos obrigatórios
 * @returns {boolean} - True se todos os campos estão preenchidos
 */
function validarCamposObrigatorios(campos, nomes) {
    return nomes.every(nome => campos[nome] && String(campos[nome]).trim().length > 0);
}

/**
 * Valida formato básico de email
 * @param {string} email - Email a validar
 * @returns {boolean} - True se o formato é válido
 */
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Trata erros e envia resposta padronizada
 * @param {Object} res - Objeto response do Express
 * @param {number} statusCode - Código HTTP
 * @param {string} mensagem - Mensagem de erro
 * @param {Error} erro - Objeto de erro (opcional)
 */
function tratarErro(res, statusCode, mensagem, erro = null) {
    const resposta = { erro: mensagem };
    if (erro && process.env.DEBUG === '1') {
        resposta.detalhe = erro.message; // Mostra detalhes apenas em DEBUG
    }
    res.status(statusCode).json(resposta);
}

// ==========================================
// ROTA: CADASTRO DE USUÁRIO (Compatível com LGPD)
// ==========================================
app.post('/api/usuarios/cadastro', async (req, res) => {
    const { nome, cpf, email, senha, aceitou_termos } = req.body;

    // Valida campos obrigatórios
    const camposObrigatorios = ['nome', 'cpf', 'email', 'senha'];
    if (!validarCamposObrigatorios(req.body, camposObrigatorios)) {
        return tratarErro(res, 400, 'Todos os campos (nome, cpf, email, senha) são obrigatórios.');
    }

    // Valida formato de email
    if (!validarEmail(email)) {
        return tratarErro(res, 400, 'Formato de email inválido.');
    }

    try {
        // Criptografa a senha com bcrypt (10 rounds = ~100ms no servidor padrão)
        const senha_hash = await bcrypt.hash(senha, SALT_ROUNDS);

        // Registra data de aceite de termos (compatível com LGPD)
        const data_aceite = aceitou_termos ? new Date() : null;

        // Insere usuário no banco de dados
        const [resultado] = await db.execute(
            QUERIES.INSERIR_USUARIO,
            [nome, cpf, email, senha_hash, aceitou_termos ? 1 : 0, data_aceite]
        );

        // Cria automaticamente uma conta corrente com saldo zero para o usuário.
        // Sem isso, o dashboard nunca encontra conta corrente (404) e o saldo
        // sempre aparece zerado, mesmo depois do usuário logar.
        await db.execute(
            QUERIES.INSERIR_CONTA_CORRENTE,
            [resultado.insertId, 0.00, null, null, 0.00, 0.00]
        );

        // Retorna sucesso com ID do usuário criado
        res.status(201).json({ 
            mensagem: 'Usuário cadastrado com sucesso!', 
            usuario_id: resultado.insertId 
        });
    } catch (error) {
        tratarErro(res, 500, 'Erro ao cadastrar usuário.', error);
    }
});

// ==========================================
// ROTA: LOGIN
// ==========================================
app.post('/api/usuarios/login', async (req, res) => {
    const { email, senha } = req.body;

    // Valida campos obrigatórios
    if (!email || !senha) {
        return tratarErro(res, 400, 'Email e senha são obrigatórios.');
    }

    try {
        // Busca usuário ativo no banco de dados
        const [rows] = await db.execute(
            QUERIES.BUSCAR_USUARIO_LOGIN,
            [email]
        );

        // Verifica se usuário existe
        if (rows.length === 0) {
            return tratarErro(res, 401, 'Usuário não encontrado ou inativo.');
        }

        const usuario = rows[0];

        // Compara senha informada com hash armazenado (seguro contra timing attacks)
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return tratarErro(res, 401, 'Senha incorreta.');
        }

        // Retorna dados do usuário (sem expor informações sensíveis)
        res.json({
            mensagem: 'Login realizado com sucesso!',
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email
            }
        });
    } catch (error) {
        tratarErro(res, 500, 'Erro ao processar login.', error);
    }
});

// ==========================================
// ROTA: REGISTRAR CONTA CORRENTE
// ==========================================
/**
 * POST /api/contas/corrente
 * Registra uma nova conta corrente para um usuário
 * 
 * Body esperado:
 * {
 *   usuario_id: number (obrigatório),
 *   saldo: number (padrão: 0.00),
 *   pix: string (opcional),
 *   cartoes: array (opcional),
 *   faturas: number (padrão: 0.00),
 *   rendimentos: number (padrão: 0.00)
 * }
 */
app.post('/api/contas/corrente', async (req, res) => {
    const { usuario_id, saldo, pix, cartoes, faturas, rendimentos } = req.body;

    // Valida campo obrigatório
    if (!usuario_id) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório.');
    }

    // Valida se usuario_id é um número válido
    if (isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário deve ser um número positivo válido.');
    }

    try {
        // Insere conta corrente com valores padrão (null/0) para campos não informados
        const [resultado] = await db.execute(
            QUERIES.INSERIR_CONTA_CORRENTE,
            [
                usuario_id,
                saldo || 0.00,
                pix || null,
                cartoes ? JSON.stringify(cartoes) : null, // Serializa array como JSON se fornecido
                faturas || 0.00,
                rendimentos || 0.00
            ]
        );

        // Retorna sucesso com ID da conta criada
        res.status(201).json({
            mensagem: 'Conta corrente registrada com sucesso!',
            conta_id: resultado.insertId,
            usuario_id: usuario_id
        });
    } catch (error) {
        // Verifica se erro é por constraint (ex: usuário não existe)
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return tratarErro(res, 404, 'Usuário não encontrado.', error);
        }
        tratarErro(res, 500, 'Erro ao registrar conta corrente.', error);
    }
});

// ==========================================
// ROTA: BUSCAR CONTA CORRENTE DO USUÁRIO
// ==========================================
/**
 * GET /api/contas/corrente/:usuario_id
 * Busca informações completas da conta corrente de um usuário
 * 
 * Parâmetros:
 * - usuario_id: ID do usuário (obrigatório)
 * 
 * Retorna:
 * - conta_id, nome, cpf, saldo, pix, cartoes, faturas, rendimentos, data_cadastro
 */
app.get('/api/contas/corrente/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;

    // Valida se usuario_id foi informado e é válido
    if (!usuario_id) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório.');
    }

    if (isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário deve ser um número positivo válido.');
    }

    try {
        // Busca dados da conta corrente com informações do usuário (JOIN)
        const [rows] = await db.execute(
            QUERIES.BUSCAR_CONTA_CORRENTE,
            [usuario_id]
        );

        // Verifica se conta existe
        if (rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Nenhuma conta corrente encontrada para este usuário.'
            });
        }

        // Se cartoes está em formato JSON string, faz parse
        const conta = rows[0];
        if (conta.cartoes && typeof conta.cartoes === 'string') {
            try {
                conta.cartoes = JSON.parse(conta.cartoes);
            } catch (e) {
                // Se não conseguir fazer parse, retorna como string mesmo
            }
        }

        // Retorna dados da conta (primeira linha, pois é JOIN 1:1)
        res.json(conta);
    } catch (error) {
        tratarErro(res, 500, 'Erro ao buscar dados da conta corrente.', error);
    }
});

// ==========================================
// ROTA: REGISTRAR CONTA POUPANÇA
// ==========================================
/**
 * POST /api/contas/poupanca
 * Cria uma nova conta poupança para um usuário
 * 
 * Body esperado:
 * {
 *   usuario_id: number (obrigatório),
 *   saldo: number (padrão: 0.00),
 *   taxa_rendimento: number (padrão: 0.5, porcentagem ao mês)
 * }
 */
app.post('/api/contas/poupanca', async (req, res) => {
    const { usuario_id, saldo, taxa_rendimento } = req.body;

    // Validação de campo obrigatório
    if (!usuario_id) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório.');
    }

    // Validação de tipo
    if (isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário deve ser um número positivo válido.');
    }

    try {
        // Insere conta poupança com valores padrão
        const [resultado] = await db.execute(
            QUERIES.INSERIR_CONTA_POUPANCA,
            [
                usuario_id,
                saldo || 0.00,
                taxa_rendimento || 0.5 // Taxa padrão de 0.5% ao mês
            ]
        );

        // Retorna sucesso com ID da conta criada
        res.status(201).json({
            mensagem: 'Conta poupança registrada com sucesso!',
            conta_id: resultado.insertId,
            usuario_id: usuario_id
        });
    } catch (error) {
        // Verifica se erro é por constraint
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return tratarErro(res, 404, 'Usuário não encontrado.', error);
        }
        tratarErro(res, 500, 'Erro ao registrar conta poupança.', error);
    }
});

// ==========================================
// ROTA: BUSCAR CONTA POUPANÇA DO USUÁRIO
// ==========================================
/**
 * GET /api/contas/poupanca/:usuario_id
 * Busca informações completas da conta poupança de um usuário
 * 
 * Parâmetros:
 * - usuario_id: ID do usuário (obrigatório)
 * 
 * Retorna:
 * - conta_id, nome, cpf, saldo, taxa_rendimento, data_cadastro
 */
app.get('/api/contas/poupanca/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;

    // Validação
    if (!usuario_id) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório.');
    }

    if (isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário deve ser um número positivo válido.');
    }

    try {
        // Busca dados da conta poupança com informações do usuário
        const [rows] = await db.execute(
            QUERIES.BUSCAR_CONTA_POUPANCA,
            [usuario_id]
        );

        // Verifica se conta existe
        if (rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Nenhuma conta poupança encontrada para este usuário.'
            });
        }

        // Retorna dados da conta
        res.json(rows[0]);
    } catch (error) {
        tratarErro(res, 500, 'Erro ao buscar dados da conta poupança.', error);
    }
});

// ==========================================
// ROTA: ATUALIZAR CONTA POUPANÇA
// ==========================================
/**
 * PUT /api/contas/poupanca/:conta_id
 * Atualiza dados da conta poupança
 * 
 * Parâmetros:
 * - conta_id: ID da conta (obrigatório)
 * 
 * Body esperado:
 * {
 *   saldo: number (novo saldo),
 *   taxa_rendimento: number (nova taxa)
 * }
 */
app.put('/api/contas/poupanca/:conta_id', async (req, res) => {
    const { conta_id } = req.params;
    const { saldo, taxa_rendimento } = req.body;

    // Validação de ID
    if (!conta_id) {
        return tratarErro(res, 400, 'O id da conta é obrigatório.');
    }

    if (isNaN(conta_id) || conta_id <= 0) {
        return tratarErro(res, 400, 'O id da conta deve ser um número positivo válido.');
    }

    // Validação de campos a atualizar
    if (saldo === undefined && taxa_rendimento === undefined) {
        return tratarErro(res, 400, 'Informe pelo menos um campo para atualizar (saldo ou taxa_rendimento).');
    }

    try {
        // Determina valores a atualizar (usa valores anteriores se não informado)
        let novoSaldo = saldo;
        let novaTaxa = taxa_rendimento;

        // Se algum campo não foi informado, busca o valor anterior
        if (saldo === undefined || taxa_rendimento === undefined) {
            const [rows] = await db.execute(
                'SELECT saldo, taxa_rendimento FROM poupanca WHERE id = ?',
                [conta_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    mensagem: 'Conta poupança não encontrada.'
                });
            }

            novoSaldo = saldo !== undefined ? saldo : rows[0].saldo;
            novaTaxa = taxa_rendimento !== undefined ? taxa_rendimento : rows[0].taxa_rendimento;
        }

        // Atualiza a conta
        const [resultado] = await db.execute(
            QUERIES.ATUALIZAR_CONTA_POUPANCA,
            [novoSaldo, novaTaxa, conta_id]
        );

        // Verifica se alguma linha foi afetada
        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Conta poupança não encontrada.'
            });
        }

        // Retorna sucesso
        res.json({
            mensagem: 'Conta poupança atualizada com sucesso!',
            conta_id: conta_id,
            saldo: novoSaldo,
            taxa_rendimento: novaTaxa
        });
    } catch (error) {
        tratarErro(res, 500, 'Erro ao atualizar conta poupança.', error);
    }
});

// ==========================================
// ROTA: DELETAR CONTA POUPANÇA
// ==========================================
/**
 * DELETE /api/contas/poupanca/:conta_id
 * Deleta uma conta poupança (operação irreversível)
 * 
 * Parâmetros:
 * - conta_id: ID da conta (obrigatório)
 */
app.delete('/api/contas/poupanca/:conta_id', async (req, res) => {
    const { conta_id } = req.params;

    // Validação
    if (!conta_id) {
        return tratarErro(res, 400, 'O id da conta é obrigatório.');
    }

    if (isNaN(conta_id) || conta_id <= 0) {
        return tratarErro(res, 400, 'O id da conta deve ser um número positivo válido.');
    }

    try {
        // Deleta a conta
        const [resultado] = await db.execute(
            QUERIES.DELETAR_CONTA_POUPANCA,
            [conta_id]
        );

        // Verifica se alguma linha foi afetada
        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Conta poupança não encontrada.'
            });
        }

        // Retorna sucesso
        res.json({
            mensagem: 'Conta poupança deletada com sucesso!',
            conta_id: conta_id
        });
    } catch (error) {
        tratarErro(res, 500, 'Erro ao deletar conta poupança.', error);
    }
});

// ==========================================
// ROTA: REGISTRAR TRANSAÇÃO
// ==========================================
/**
 * POST /api/transacoes
 * Registra uma nova transação (receita ou despesa) e ajusta o saldo
 * da conta corrente do usuário automaticamente.
 *
 * Body esperado:
 * {
 *   usuario_id: number (obrigatório),
 *   tipo: 'receita' | 'despesa' (obrigatório),
 *   categoria: string (obrigatório),
 *   descricao: string (obrigatório),
 *   valor: number positivo (obrigatório),
 *   data: string 'YYYY-MM-DD' (obrigatório)
 * }
 */
app.post('/api/transacoes', async (req, res) => {
    const { usuario_id, tipo, categoria, descricao, valor, data } = req.body;

    if (!validarCamposObrigatorios(req.body, ['usuario_id', 'tipo', 'categoria', 'descricao', 'valor', 'data'])) {
        return tratarErro(res, 400, 'Todos os campos (usuario_id, tipo, categoria, descricao, valor, data) são obrigatórios.');
    }

    if (tipo !== 'receita' && tipo !== 'despesa') {
        return tratarErro(res, 400, "O campo 'tipo' deve ser 'receita' ou 'despesa'.");
    }

    if (isNaN(valor) || valor <= 0) {
        return tratarErro(res, 400, 'O valor deve ser um número positivo.');
    }

    try {
        // Registra a transação
        const [resultado] = await db.execute(
            QUERIES.INSERIR_TRANSACAO,
            [usuario_id, tipo, categoria, descricao, valor, data]
        );

        // Ajusta o saldo da conta corrente: receita soma, despesa subtrai
        const delta = tipo === 'receita' ? valor : -valor;
        await db.execute(QUERIES.ATUALIZAR_SALDO_CORRENTE, [delta, usuario_id]);

        res.status(201).json({
            mensagem: 'Transação registrada com sucesso!',
            transacao_id: resultado.insertId
        });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return tratarErro(res, 404, 'Usuário não encontrado.', error);
        }
        tratarErro(res, 500, 'Erro ao registrar transação.', error);
    }
});

// ==========================================
// ROTA: LISTAR TRANSAÇÕES DO USUÁRIO
// ==========================================
/**
 * GET /api/transacoes/:usuario_id
 * Lista todas as transações de um usuário, mais recentes primeiro.
 */
app.get('/api/transacoes/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;

    if (isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário deve ser um número positivo válido.');
    }

    try {
        const [rows] = await db.execute(QUERIES.LISTAR_TRANSACOES, [usuario_id]);
        res.json(rows);
    } catch (error) {
        tratarErro(res, 500, 'Erro ao listar transações.', error);
    }
});

// ==========================================
// ROTA: EXCLUIR USUÁRIO (compatível com LGPD)
// ==========================================
/**
 * DELETE /api/usuarios/:id
 * Apaga o usuário e, em cascata (via FK ON DELETE CASCADE no banco),
 * suas contas corrente/poupança e transações.
 */
app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    if (isNaN(id) || id <= 0) {
        return tratarErro(res, 400, 'O id do usuário deve ser um número positivo válido.');
    }

    try {
        const [resultado] = await db.execute(QUERIES.DELETAR_USUARIO, [id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
        }

        res.json({ mensagem: 'Usuário e todos os seus dados foram excluídos com sucesso.' });
    } catch (error) {
        tratarErro(res, 500, 'Erro ao excluir usuário.', error);
    }
});

// ==========================================
// ROTAS: DADOS DO DASHBOARD RICO (index.html / BackEnd/script.js)
// ==========================================
/**
 * O dashboard de index.html guarda todo o seu estado (contas, categorias,
 * transações, orçamentos, metas, config) como um blob JSON único por
 * usuário. As três rotas abaixo fazem CRUD desse blob.
 *
 * Identificação do usuário: como esse dashboard não usa cookie/sessão,
 * o usuario_id é enviado explicitamente:
 *  - GET/DELETE: como query string  (?usuario_id=123)
 *  - POST:       dentro do corpo    ({ usuario_id: 123, ... })
 */

/**
 * GET /api/data?usuario_id=123
 * Retorna o blob de dados salvo do usuário. Se ainda não existir nada
 * salvo, responde 404 (o front-end usa isso para gerar os dados de
 * exemplo e salvá-los na primeira vez).
 */
app.get('/api/data', async (req, res) => {
    const { usuario_id } = req.query;

    if (!usuario_id || isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório (query string ?usuario_id=).');
    }

    try {
        const [rows] = await db.execute(QUERIES.BUSCAR_DADOS_FINANCEIROS, [usuario_id]);

        if (rows.length === 0) {
            return res.status(404).json({ mensagem: 'Nenhum dado salvo para este usuário.' });
        }

        // O driver mysql2 já retorna colunas JSON como objeto JS
        res.json(rows[0].dados);
    } catch (error) {
        tratarErro(res, 500, 'Erro ao buscar dados do dashboard.', error);
    }
});

/**
 * POST /api/data
 * Salva (cria ou substitui) o blob de dados do usuário.
 * Body esperado: { usuario_id: number, ...restante do estado do dashboard }
 */
app.post('/api/data', async (req, res) => {
    const { usuario_id, ...dados } = req.body;

    if (!usuario_id || isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório (campo usuario_id no corpo).');
    }

    try {
        await db.execute(
            QUERIES.SALVAR_DADOS_FINANCEIROS,
            [usuario_id, JSON.stringify(dados)]
        );
        res.json({ mensagem: 'Dados salvos com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return tratarErro(res, 404, 'Usuário não encontrado.', error);
        }
        tratarErro(res, 500, 'Erro ao salvar dados do dashboard.', error);
    }
});

/**
 * DELETE /api/data?usuario_id=123
 * Apaga o blob de dados salvo do usuário (usado pelo botão "Redefinir dados").
 */
app.delete('/api/data', async (req, res) => {
    const { usuario_id } = req.query;

    if (!usuario_id || isNaN(usuario_id) || usuario_id <= 0) {
        return tratarErro(res, 400, 'O id do usuário é obrigatório (query string ?usuario_id=).');
    }

    try {
        await db.execute(QUERIES.DELETAR_DADOS_FINANCEIROS, [usuario_id]);
        res.json({ mensagem: 'Dados do dashboard apagados com sucesso!' });
    } catch (error) {
        tratarErro(res, 500, 'Erro ao apagar dados do dashboard.', error);
    }
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    if (process.env.DEBUG === '1') {
        console.log('📋 Modo DEBUG ativado - Detalhes de erro aparecerão nas respostas');
    }
});