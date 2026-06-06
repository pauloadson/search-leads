/**
 * @fileoverview Definição das rotas de API da aplicação.
 */

const express = require('express');
const router = express.Router();

const scraperController = require('../controllers/scraper.controller');
const leadController = require('../controllers/lead.controller');

// Rotas do Scraper (automação)
router.get('/scraper/search', scraperController.startSearch);
router.post('/scraper/cancel', scraperController.cancelSearch);

// Rotas de Dados (Leads e Histórico)
router.get('/leads', leadController.getLeads);
router.put('/leads/status', leadController.updateStatus);
router.get('/searches', leadController.getSearches);
router.delete('/searches/:id', leadController.deleteSearch);

module.exports = router;
