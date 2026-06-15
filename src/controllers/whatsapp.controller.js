/**
 * @fileoverview Controller para os endpoints de controle da automação do WhatsApp.
 */

const whatsappService = require('../services/whatsapp.service');

async function startCampaign(req, res) {
  try {
    const { 
      batchSize = 10, 
      typingDelay = 2, 
      messageDelay = 5, 
      filterContacted = 'nao_contatados', 
      templateMessage = 'Olá {nome}, tudo bem?' 
    } = req.body;
    
    if (whatsappService.getStatus().isRunning) {
      return res.status(400).json({ error: 'Já existe um lote em andamento. Pare o atual antes de iniciar outro.' });
    }

    // Inicia o worker em background (não usa await para não prender a requisição HTTP)
    whatsappService.startCampaign({
      batchSize: parseInt(batchSize, 10),
      typingDelay: parseInt(typingDelay, 10),
      messageDelay: parseInt(messageDelay, 10),
      filterContacted,
      templateMessage
    });

    return res.status(200).json({ message: 'Campanha iniciada com sucesso. Acompanhe o status.' });
  } catch (error) {
    console.error('Erro ao iniciar campanha do WhatsApp:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao iniciar campanha.' });
  }
}

async function stopCampaign(req, res) {
  try {
    const stopped = whatsappService.stopCampaign();
    if (stopped) {
      return res.status(200).json({ message: 'Parada solicitada. O worker vai parar assim que finalizar a ação atual.' });
    }
    return res.status(400).json({ error: 'Nenhuma campanha em andamento no momento.' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao tentar parar a campanha.' });
  }
}

async function getStatus(req, res) {
  try {
    return res.status(200).json(whatsappService.getStatus());
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao obter status da campanha.' });
  }
}

module.exports = {
  startCampaign,
  stopCampaign,
  getStatus
};
