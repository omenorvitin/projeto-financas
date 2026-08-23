// ==========================================
// CONFIGURAÇÃO DO POOL DE CONEXÕES MYSQL
// ==========================================

/**
 * Gerenciador de conexões com o banco de dados MySQL.
 * 
 * Utiliza pool de conexões (mysql2/promise) para:
 * - Reutilizar conexões (melhor performance)
 * - Limitar uso de memória
 * - Permitir operações assincrónas com async/await
 * 
 * Veja: https://github.com/sidorares/node-mysql2
 */

// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

const mysql = require('mysql2/promise');

/**
 * Pool de conexões MySQL com configurações do .env
 * 
 * Variáveis de ambiente:
 *  - DB_HOST: servidor MySQL (padrão: localhost)
 *  - DB_USER: usuário MySQL (padrão: root)
 *  - DB_PASSWORD: senha do usuário (padrão: string vazia)
 *  - DB_NAME: nome do banco de dados (padrão: financas)
 * 
 * Configurações do pool:
 *  - waitForConnections: aguarda se o pool está cheio (true = melhor para produção)
 *  - connectionLimit: máximo de conexões simultâneas (10 é bom para apps pequenas/médias)
 *  - queueLimit: máximo de requisições em fila (0 = sem limite)
 */
const pool = mysql.createPool({
    // Configurações de conexão
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'financas',
    
    // Configurações do pool
    waitForConnections: true,      // Aguarda conexão disponível
    connectionLimit: 10,             // Máximo de 10 conexões ativas
    queueLimit: 0                    // Sem limite de fila
});

/**
 * Exporta o pool para que outras rotas (server.js) possam utilizá-lo
 * 
 * Uso em outras arquivos:
 *  const db = require('./db');
 *  const [rows] = await db.execute('SELECT * FROM usuarios', []);
 */
module.exports = pool;