/**
 * @fileoverview Configuração da conexão com o banco de dados MySQL e inicialização das tabelas.
 * Documenta a conexão utilizando pool do mysql2 com suporte a Promises.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Recupera variáveis de ambiente
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'leads_db';
const dbPort = process.env.DB_PORT || 3306;

let pool = null;

/**
 * Cria o banco de dados se ele não existir e inicializa a conexão do pool.
 * @async
 * @function initializeDatabase
 * @returns {Promise<mysql.Pool>} Retorna o pool de conexões do MySQL.
 */
async function initializeDatabase() {
  try {
    // Conecta temporariamente sem especificar o banco de dados para criá-lo se necessário
    const tempConnection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort
    });

    // Cria o banco de dados se não existir
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await tempConnection.end();

    // Cria o pool principal apontando para o banco de dados correto
    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Cria as tabelas do sistema
    await createTables();

    return pool;
  } catch (error) {
    console.error('Erro ao conectar ou criar o banco de dados MySQL:', error.message);
    throw error;
  }
}

/**
 * Cria as tabelas 'searches' e 'leads' no MySQL caso não existam.
 * Utiliza o padrão snake_case para o banco de dados, em inglês e no plural.
 * @async
 * @function createTables
 * @returns {Promise<void>}
 */
async function createTables() {
  if (!pool) {
    throw new Error('O pool do banco de dados não foi inicializado.');
  }

  const connection = await pool.getConnection();
  try {
    // Inicia uma transação para criação das tabelas
    await connection.beginTransaction();

    // 1. Tabela 'searches'
    await connection.query(`
      CREATE TABLE IF NOT EXISTS searches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tabela 'leads'
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        search_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        website VARCHAR(500),
        address TEXT,
        rating DECIMAL(3,2),
        reviews_count INT DEFAULT 0,
        category VARCHAR(255),
        google_maps_url VARCHAR(1000),
        instagram VARCHAR(255),
        contacted TINYINT DEFAULT 0,
        interest_status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        last_contact_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE,
        UNIQUE KEY unique_lead_name_address (name, address(100))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Tabela 'message_templates'
    await connection.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_default TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migração automática: Adiciona a coluna instagram caso a tabela já exista e não a contenha
    const [columns] = await connection.query("SHOW COLUMNS FROM leads LIKE 'instagram'");
    if (columns.length === 0) {
      await connection.query("ALTER TABLE leads ADD COLUMN instagram VARCHAR(255) NULL AFTER google_maps_url;");
    }

    // Migração automática: Adiciona a coluna contacted
    const [contactedCol] = await connection.query("SHOW COLUMNS FROM leads LIKE 'contacted'");
    if (contactedCol.length === 0) {
      await connection.query("ALTER TABLE leads ADD COLUMN contacted TINYINT DEFAULT 0 AFTER instagram;");
    }

    // Migração automática: Adiciona a coluna interest_status
    const [interestCol] = await connection.query("SHOW COLUMNS FROM leads LIKE 'interest_status'");
    if (interestCol.length === 0) {
      await connection.query("ALTER TABLE leads ADD COLUMN interest_status VARCHAR(50) DEFAULT 'pending' AFTER contacted;");
    }

    // Migração automática: Adiciona a coluna notes
    const [notesCol] = await connection.query("SHOW COLUMNS FROM leads LIKE 'notes'");
    if (notesCol.length === 0) {
      await connection.query("ALTER TABLE leads ADD COLUMN notes TEXT NULL AFTER interest_status;");
    }

    // Migração automática: Adiciona a coluna last_contact_at
    const [lastContactCol] = await connection.query("SHOW COLUMNS FROM leads LIKE 'last_contact_at'");
    if (lastContactCol.length === 0) {
      await connection.query("ALTER TABLE leads ADD COLUMN last_contact_at TIMESTAMP NULL AFTER notes;");
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao criar as tabelas no MySQL:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Retorna o pool ativo. Se não existir, tenta inicializá-lo.
 * @function getPool
 * @returns {mysql.Pool}
 */
function getPool() {
  if (!pool) {
    throw new Error('Banco de dados não inicializado. Chame initializeDatabase() primeiro.');
  }
  return pool;
}

module.exports = {
  initializeDatabase,
  getPool
};
