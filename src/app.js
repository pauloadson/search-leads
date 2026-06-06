/**
 * @fileoverview Configuração do aplicativo Express, middlewares e arquivos estáticos.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./config/swagger.json');
const apiRoutes = require('./routes/api');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota do Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve arquivos estáticos da interface web na raiz
app.use(express.static(path.join(__dirname, '../public')));


// Rotas da API
app.use('/api', apiRoutes);

// Fallback para servir a interface web (Single Page Application fallback simples)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
