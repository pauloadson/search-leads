/**
 * @fileoverview Controller para gerenciamento de leads e pesquisas armazenados no banco de dados.
 * Fornece endpoints para listagem de dados históricos e remoção de registros.
 */

const dbService = require('../services/db.service');
const { getPool } = require('../config/database');

/**
 * Retorna os leads salvos no banco. Aceita filtro opcional por ID de busca (searchId) e paginação.
 * @async
 * @function getLeads
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {Promise<void>}
 */
async function getLeads(req, res) {
  try {
    const { searchId, search, contacted, interestStatus, page = 1, limit = 50 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);

    let result;
    if (searchId) {
      result = await dbService.getLeadsBySearchId(parseInt(searchId, 10), {
        searchTerm: search,
        contacted,
        interestStatus,
        page: parsedPage,
        limit: parsedLimit
      });
    } else {
      result = await dbService.getAllLeads({
        searchTerm: search,
        contacted,
        interestStatus,
        page: parsedPage,
        limit: parsedLimit
      });
    }

    const totalPages = Math.ceil((result.totalItems || 0) / parsedLimit);

    return res.status(200).json({
      leads: result.leads,
      totalItems: result.totalItems,
      totalPages,
      currentPage: parsedPage,
      limit: parsedLimit
    });
  } catch (error) {
    console.error('Erro ao recuperar leads:', error);
    return res.status(500).json({ error: 'Erro interno ao recuperar leads do banco de dados.' });
  }
}

/**
 * Retorna o histórico de pesquisas realizadas.
 * @async
 * @function getSearches
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {Promise<void>}
 */
async function getSearches(req, res) {
  try {
    const searches = await dbService.getAllSearches();
    return res.status(200).json(searches);
  } catch (error) {
    console.error('Erro ao recuperar histórico de pesquisas:', error);
    return res.status(500).json({ error: 'Erro interno ao recuperar histórico de pesquisas.' });
  }
}

/**
 * Exclui uma pesquisa e todos os seus leads associados (cascade delete).
 * @async
 * @function deleteSearch
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {Promise<void>}
 */
async function deleteSearch(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'O ID da pesquisa é obrigatório.' });
    }

    const pool = getPool();
    const sql = 'DELETE FROM searches WHERE id = ?';
    const [result] = await pool.query(sql, [parseInt(id, 10)]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    }

    return res.status(200).json({ message: 'Pesquisa e leads associados removidos com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir pesquisa:', error);
    return res.status(500).json({ error: 'Erro interno ao tentar excluir pesquisa do banco.' });
  }
}

/**
 * Atualiza o status de contato, interesse ou notas de múltiplos leads em lote.
 * @async
 * @function updateStatus
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {Promise<void>}
 */
async function updateStatus(req, res) {
  try {
    const { leadIds, contacted, interestStatus, notes } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'O campo "leadIds" deve ser um array não vazio.' });
    }

    await dbService.updateLeadsStatus(leadIds, { contacted, interestStatus, notes });

    return res.status(200).json({ message: 'Status dos leads atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar status dos leads:', error);
    return res.status(500).json({ error: 'Erro interno ao tentar atualizar status no banco.' });
  }
}

/**
 * Atualiza dados parciais de um lead específico.
 * @async
 * @function updateLead
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 * @returns {Promise<void>}
 */
async function updateLead(req, res) {
  try {
    const { id } = req.params;
    const { phone, instagram, notes, contacted, interestStatus, website, address, category } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'O ID do lead é obrigatório.' });
    }

    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'ID do lead inválido.' });
    }

    // Verifica se o lead existe
    const existingLead = await dbService.getLeadById(leadId);
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    // Filtra e prepara os campos a atualizar
    const fieldsToUpdate = {};
    if (phone !== undefined) fieldsToUpdate.phone = phone;
    if (instagram !== undefined) fieldsToUpdate.instagram = instagram;
    if (notes !== undefined) fieldsToUpdate.notes = notes;
    if (contacted !== undefined) fieldsToUpdate.contacted = contacted;
    if (interestStatus !== undefined) fieldsToUpdate.interestStatus = interestStatus;
    if (website !== undefined) fieldsToUpdate.website = website;
    if (address !== undefined) fieldsToUpdate.address = address;
    if (category !== undefined) fieldsToUpdate.category = category;

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualização foi fornecido.' });
    }

    await dbService.updateLead(leadId, fieldsToUpdate);

    // Recupera o lead atualizado para retornar
    const updatedLead = await dbService.getLeadById(leadId);

    return res.status(200).json({
      message: 'Lead atualizado com sucesso.',
      lead: updatedLead
    });
  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    return res.status(500).json({ error: 'Erro interno ao tentar atualizar lead no banco.' });
  }
}

module.exports = {
  getLeads,
  getSearches,
  deleteSearch,
  updateStatus,
  updateLead
};
