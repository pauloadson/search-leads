/**
 * @fileoverview Ponto de entrada do servidor. Inicializa o banco de dados MySQL e inicia o escutador HTTP do Express.
 */

require('dotenv').config();
const { initializeDatabase } = require('./config/database');
const app = require('./app');

const PORT = process.env.PORT || 3000;

/**
 * Função principal para inicialização e escuta da aplicação.
 * @async
 */
async function startServer() {
  try {
    console.log('Inicializando conexão com banco de dados MySQL...');
    await initializeDatabase();
    console.log('Banco de dados inicializado e tabelas estruturadas.');

    app.listen(PORT, () => {
      console.log(`========================================================`);
      console.log(` Servidor ativo na porta ${PORT}`);
      console.log(` Acesse a interface web em: http://localhost:${PORT}`);
      console.log(`========================================================`);
    });
  } catch (error) {
    console.error('Falha crítica ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

startServer();
