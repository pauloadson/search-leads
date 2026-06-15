/**
 * @fileoverview Definição das rotas de API da aplicação.
 */

const express = require('express');
const router = express.Router();

const scraperController = require('../controllers/scraper.controller');
const leadController = require('../controllers/lead.controller');
const whatsappController = require('../controllers/whatsapp.controller');
const templateController = require('../controllers/template.controller');

// Rotas do Scraper (automação)
router.get('/scraper/search', scraperController.startSearch);
router.post('/scraper/cancel', scraperController.cancelSearch);

// Rotas de Dados (Leads e Histórico)
router.get('/leads', leadController.getLeads);
router.put('/leads/status', leadController.updateStatus);
router.patch('/leads/:id', leadController.updateLead);
router.get('/searches', leadController.getSearches);
router.delete('/searches/:id', leadController.deleteSearch);

// Rotas da Automação de WhatsApp
router.post('/whatsapp/start', whatsappController.startCampaign);
router.post('/whatsapp/stop', whatsappController.stopCampaign);
router.get('/whatsapp/status', whatsappController.getStatus);

// Rotas de Templates de Mensagem
router.get('/templates', templateController.getTemplates);
router.post('/templates', templateController.saveTemplate);
router.delete('/templates/:id', templateController.deleteTemplate);

module.exports = router;
