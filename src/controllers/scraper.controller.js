/**
 * @fileoverview Controller para gerenciar o acionamento e cancelamento do scraper do Google Maps.
 * Implementa comunicação em tempo real via Server-Sent Events (SSE).
 */

const scraperService = require('../services/scraper.service');
const dbService = require('../services/db.service');

/**
 * Controla a execução do scraper de leads enviando logs e resultados em tempo real via Server-Sent Events (SSE).
 * @async
 * @function startSearch
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {Promise<void>}
 */
async function startSearch(req, res) {
  const { query, location, limit } = req.query;

  // Validação simples dos campos obrigatórios
  if (!query || !location) {
    return res.status(400).json({ error: 'Os campos "query" e "location" são obrigatórios.' });
  }

  const limitNumber = parseInt(limit, 10) || 20;

  // Configura os headers necessários para Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Encoding': 'none'
  });

  // Envia ping inicial para manter a conexão ativa
  res.write(': ping\n\n');

  let searchId = null;

  try {
    // 1. Registra a pesquisa no histórico
    searchId = await dbService.saveSearch({ query, location });
    
    // Função utilitária para enviar pacotes de dados formatados em SSE
    const sendSSE = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Envia o ID da busca gerado para o cliente
    sendSSE('search_started', { searchId, query, location, limit: limitNumber });

    // 2. Executa a automação
    await scraperService.runScraper({
      searchId,
      query,
      location,
      limit: limitNumber,
      onProgress: async (progress) => {
        if (progress.status === 'lead_found') {
          try {
            // Salva o lead no MySQL (nomenclatura snake_case interna e única)
            const savedLead = await dbService.saveLead(progress.lead);
            // Retorna o lead salvo (com ID final do banco) para o frontend em camelCase
            sendSSE('lead_found', savedLead);
          } catch (dbError) {
            console.error('Erro ao salvar lead extraído no banco:', dbError.message);
            sendSSE('log', { message: `Erro ao salvar lead "${progress.lead.name}" no banco de dados.` });
          }
        } else if (progress.status === 'completed') {
          sendSSE('completed', { message: progress.message });
          res.end();
        } else if (progress.status === 'failed') {
          sendSSE('failed', { message: progress.message });
          res.end();
        } else {
          // Eventos genéricos de log e progresso
          sendSSE('log', { status: progress.status, message: progress.message });
        }
      }
    });

  } catch (error) {
    console.error('Erro na requisição de busca do scraper:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }

  // Se a conexão do cliente cair, interrompe a automação no servidor
  req.on('close', () => {
    if (searchId) {
      const wasCancelled = scraperService.cancelScraper(searchId);
      if (wasCancelled) {
        console.log(`Pesquisa ID ${searchId} abortada devido à desconexão do cliente.`);
      }
    }
  });
}

/**
 * Endpoint para cancelar manualmente uma busca em execução.
 * @function cancelSearch
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {void}
 */
function cancelSearch(req, res) {
  const { searchId } = req.body;

  if (!searchId) {
    return res.status(400).json({ error: 'O campo "searchId" é obrigatório.' });
  }

  const wasCancelled = scraperService.cancelScraper(parseInt(searchId, 10));

  if (wasCancelled) {
    return res.status(200).json({ message: 'Busca cancelada com sucesso.' });
  } else {
    return res.status(404).json({ error: 'Busca não encontrada ou já encerrada.' });
  }
}

module.exports = {
  startSearch,
  cancelSearch
};
