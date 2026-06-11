/**
 * @fileoverview Serviço responsável pelas operações de leitura e escrita no banco de dados MySQL,
 * mapeando nomenclatura snake_case do banco para camelCase da API.
 */

const { getPool } = require('../config/database');

/**
 * Converte um registro do banco de dados (snake_case) para formato de objeto da API (camelCase).
 * @param {Object} row - Linha crua retornada do MySQL.
 * @returns {Object|null} Objeto mapeado para camelCase ou null se a linha for nula/indefinida.
 */
function rowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    searchId: row.search_id,
    name: row.name,
    phone: row.phone,
    website: row.website,
    address: row.address,
    rating: row.rating ? parseFloat(row.rating) : null,
    reviewsCount: row.reviews_count,
    category: row.category,
    googleMapsUrl: row.google_maps_url,
    instagram: row.instagram,
    contacted: row.contacted === 1,
    interestStatus: row.interest_status,
    notes: row.notes,
    lastContactAt: row.last_contact_at,
    createdAt: row.created_at
  };
}

/**
 * Converte um registro de busca do banco de dados para camelCase.
 * @param {Object} row - Linha crua da tabela searches.
 * @returns {Object|null}
 */
function rowToSearch(row) {
  if (!row) return null;
  return {
    id: row.id,
    query: row.query,
    location: row.location,
    createdAt: row.created_at
  };
}

/**
 * Registra uma nova pesquisa no histórico.
 * @async
 * @function saveSearch
 * @param {Object} searchParams - Parâmetros da pesquisa.
 * @param {string} searchParams.query - Termo pesquisado.
 * @param {string} searchParams.location - Localização pesquisada.
 * @returns {Promise<number>} ID da pesquisa inserida.
 */
async function saveSearch({ query, location }) {
  const pool = getPool();
  const sql = 'INSERT INTO searches (query, location) VALUES (?, ?)';
  const [result] = await pool.query(sql, [query, location]);
  return result.insertId;
}

/**
 * Insere ou atualiza um lead no banco de dados MySQL.
 * Evita duplicidades usando a restrição UNIQUE criada sobre (name, address).
 * @async
 * @function saveLead
 * @param {Object} lead - Objeto com dados do lead em formato camelCase.
 * @param {number} lead.searchId - ID da busca correspondente.
 * @param {string} lead.name - Nome do estabelecimento.
 * @param {string|null} lead.phone - Telefone de contato.
 * @param {string|null} lead.website - URL do site.
 * @param {string|null} lead.address - Endereço completo.
 * @param {number|null} lead.rating - Avaliação (0 a 5).
 * @param {number} lead.reviewsCount - Quantidade de avaliações.
 * @param {string|null} lead.category - Categoria do negócio.
 * @param {string|null} lead.googleMapsUrl - Link do Maps.
 * @returns {Promise<Object>} Retorna o lead salvo com o respectivo ID gerado.
 */
async function saveLead(lead) {
  const pool = getPool();
  const sql = `
    INSERT INTO leads (
      search_id, name, phone, website, address, rating, reviews_count, category, google_maps_url, instagram
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      search_id = VALUES(search_id),
      phone = COALESCE(VALUES(phone), phone),
      website = COALESCE(VALUES(website), website),
      rating = VALUES(rating),
      reviews_count = VALUES(reviews_count),
      category = VALUES(category),
      google_maps_url = VALUES(google_maps_url),
      instagram = COALESCE(VALUES(instagram), instagram)
  `;

  const values = [
    lead.searchId,
    lead.name,
    lead.phone || null,
    lead.website || null,
    lead.address || null,
    lead.rating || null,
    lead.reviewsCount || 0,
    lead.category || null,
    lead.googleMapsUrl || null,
    lead.instagram || null
  ];

  const [result] = await pool.query(sql, values);
  
  // Se for uma nova inserção, result.insertId será o novo ID.
  // Se for um update em linha existente, precisaremos buscar o ID existente ou retornar.
  let id = result.insertId;
  if (id === 0) {
    // Busca o ID existente com base nas chaves exclusivas
    const [rows] = await pool.query('SELECT id FROM leads WHERE name = ? AND address = ?', [lead.name, lead.address]);
    if (rows.length > 0) {
      id = rows[0].id;
    }
  }

  return { ...lead, id };
}

/**
 * Recupera todos os leads do banco de dados ordenados pelos mais recentes com paginação.
 * Permite filtrar textualmente em múltiplos campos (busca no banco).
 * @async
 * @function getAllLeads
 * @param {Object} [options] - Opções de busca e paginação.
 * @param {string|null} [options.searchTerm] - Termo textual para busca (LIKE).
 * @param {boolean|string|number|null} [options.contacted] - Filtro de status de contato.
 * @param {string|null} [options.interestStatus] - Filtro de status de interesse.
 * @param {number} [options.page] - Número da página atual (1-based).
 * @param {number} [options.limit] - Quantidade máxima de registros por página.
 * @returns {Promise<{leads: Array<Object>, totalItems: number}>} Leads da página e total totalizador.
 */
async function getAllLeads({ searchTerm = null, contacted = null, interestStatus = null, page = 1, limit = 50 } = {}) {
  const pool = getPool();
  const offset = (page - 1) * limit;

  let countSql = 'SELECT COUNT(*) as total FROM leads';
  let dataSql = 'SELECT * FROM leads';
  const whereClauses = [];
  const values = [];

  if (searchTerm) {
    whereClauses.push('(name LIKE ? OR category LIKE ? OR address LIKE ? OR notes LIKE ? OR phone LIKE ?)');
    const likeTerm = `%${searchTerm}%`;
    values.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  }

  let contactedVal = null;
  if (contacted !== undefined && contacted !== null && contacted !== '') {
    if (contacted === 'true' || contacted === true || contacted === '1' || contacted === 1) {
      contactedVal = 1;
    } else if (contacted === 'false' || contacted === false || contacted === '0' || contacted === 0) {
      contactedVal = 0;
    }
  }

  if (contactedVal !== null) {
    whereClauses.push('contacted = ?');
    values.push(contactedVal);
  }

  if (interestStatus && interestStatus !== 'all') {
    whereClauses.push('interest_status = ?');
    values.push(interestStatus);
  }

  if (whereClauses.length > 0) {
    const whereClauseStr = ' WHERE ' + whereClauses.join(' AND ');
    countSql += whereClauseStr;
    dataSql += whereClauseStr;
  }

  dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const dataValues = [...values, parseInt(limit, 10), parseInt(offset, 10)];

  const [countResult] = await pool.query(countSql, values);
  const totalItems = countResult[0]?.total || 0;

  const [rows] = await pool.query(dataSql, dataValues);
  const leads = rows.map(rowToLead);

  return { leads, totalItems };
}

/**
 * Recupera os leads associados a uma busca específica com paginação e filtro opcional.
 * @async
 * @function getLeadsBySearchId
 * @param {number} searchId - ID da busca.
 * @param {Object} [options] - Opções de busca e paginação.
 * @param {string|null} [options.searchTerm] - Termo textual para busca (LIKE).
 * @param {boolean|string|number|null} [options.contacted] - Filtro de status de contato.
 * @param {string|null} [options.interestStatus] - Filtro de status de interesse.
 * @param {number} [options.page] - Número da página atual (1-based).
 * @param {number} [options.limit] - Quantidade máxima de registros por página.
 * @returns {Promise<{leads: Array<Object>, totalItems: number}>} Leads da página e total totalizador.
 */
async function getLeadsBySearchId(searchId, { searchTerm = null, contacted = null, interestStatus = null, page = 1, limit = 50 } = {}) {
  const pool = getPool();
  const offset = (page - 1) * limit;

  let countSql = 'SELECT COUNT(*) as total FROM leads WHERE search_id = ?';
  let dataSql = 'SELECT * FROM leads WHERE search_id = ?';
  const whereClauses = [];
  const values = [searchId];

  if (searchTerm) {
    whereClauses.push('(name LIKE ? OR category LIKE ? OR address LIKE ? OR notes LIKE ? OR phone LIKE ?)');
    const likeTerm = `%${searchTerm}%`;
    values.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  }

  let contactedVal = null;
  if (contacted !== undefined && contacted !== null && contacted !== '') {
    if (contacted === 'true' || contacted === true || contacted === '1' || contacted === 1) {
      contactedVal = 1;
    } else if (contacted === 'false' || contacted === false || contacted === '0' || contacted === 0) {
      contactedVal = 0;
    }
  }

  if (contactedVal !== null) {
    whereClauses.push('contacted = ?');
    values.push(contactedVal);
  }

  if (interestStatus && interestStatus !== 'all') {
    whereClauses.push('interest_status = ?');
    values.push(interestStatus);
  }

  if (whereClauses.length > 0) {
    const whereClauseStr = ' AND ' + whereClauses.join(' AND ');
    countSql += whereClauseStr;
    dataSql += whereClauseStr;
  }

  dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const dataValues = [...values, parseInt(limit, 10), parseInt(offset, 10)];

  const [countResult] = await pool.query(countSql, values);
  const totalItems = countResult[0]?.total || 0;

  const [rows] = await pool.query(dataSql, dataValues);
  const leads = rows.map(rowToLead);

  return { leads, totalItems };
}

/**
 * Recupera o histórico de pesquisas realizadas.
 * @async
 * @function getAllSearches
 * @returns {Promise<Array<Object>>} Lista de buscas em formato camelCase.
 */
async function getAllSearches() {
  const pool = getPool();
  const sql = 'SELECT * FROM searches ORDER BY created_at DESC';
  const [rows] = await pool.query(sql);
  return rows.map(rowToSearch);
}

/**
 * Atualiza o status de contato, interesse e/ou notas de múltiplos leads em lote.
 * @async
 * @function updateLeadsStatus
 * @param {Array<number>} leadIds - Lista de IDs dos leads a serem atualizados.
 * @param {Object} updateFields - Campos a serem atualizados.
 * @param {boolean} [updateFields.contacted] - Status de contato enviado.
 * @param {string} [updateFields.interestStatus] - Status de interesse ('pending', 'interested', 'not_interested').
 * @param {string} [updateFields.notes] - Observações/anotações manuais.
 * @returns {Promise<void>}
 */
async function updateLeadsStatus(leadIds, updateFields) {
  const pool = getPool();
  if (!Array.isArray(leadIds) || leadIds.length === 0) return;

  const fieldsToUpdate = [];
  const values = [];

  if (updateFields.contacted !== undefined) {
    fieldsToUpdate.push('contacted = ?');
    fieldsToUpdate.push('last_contact_at = ?');
    values.push(updateFields.contacted ? 1 : 0);
    values.push(updateFields.contacted ? new Date() : null);
  }

  if (updateFields.interestStatus !== undefined) {
    fieldsToUpdate.push('interest_status = ?');
    values.push(updateFields.interestStatus);
  }

  if (updateFields.notes !== undefined) {
    fieldsToUpdate.push('notes = ?');
    values.push(updateFields.notes);
  }

  if (fieldsToUpdate.length === 0) return;

  // Monta SQL de atualização em lote usando a cláusula IN
  const sql = `UPDATE leads SET ${fieldsToUpdate.join(', ')} WHERE id IN (?)`;
  values.push(leadIds);

  await pool.query(sql, values);
}

/**
 * Recupera um lead específico pelo seu ID.
 * @async
 * @function getLeadById
 * @param {number} id - ID do lead.
 * @returns {Promise<Object|null>} Lead correspondente ou null.
 */
async function getLeadById(id) {
  const pool = getPool();
  const sql = 'SELECT * FROM leads WHERE id = ?';
  const [rows] = await pool.query(sql, [id]);
  if (rows.length === 0) return null;
  return rowToLead(rows[0]);
}

/**
 * Atualiza campos específicos de um lead pelo ID.
 * @async
 * @function updateLead
 * @param {number} id - ID do lead.
 * @param {Object} fields - Campos a serem atualizados.
 * @returns {Promise<boolean>} Retorna true se o lead foi atualizado, false caso contrário.
 */
async function updateLead(id, fields) {
  const pool = getPool();
  
  const allowedFields = ['phone', 'instagram', 'notes', 'contacted', 'interestStatus', 'website', 'address', 'category'];
  const fieldsToUpdate = [];
  const values = [];

  const fieldMapping = {
    phone: 'phone',
    instagram: 'instagram',
    notes: 'notes',
    contacted: 'contacted',
    interestStatus: 'interest_status',
    website: 'website',
    address: 'address',
    category: 'category'
  };

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      const dbField = fieldMapping[key];
      fieldsToUpdate.push(`${dbField} = ?`);
      
      if (key === 'contacted') {
        values.push(value ? 1 : 0);
        if (value) {
          fieldsToUpdate.push('last_contact_at = ?');
          values.push(new Date());
        } else {
          fieldsToUpdate.push('last_contact_at = ?');
          values.push(null);
        }
      } else {
        values.push(value);
      }
    }
  }

  if (fieldsToUpdate.length === 0) return false;

  const sql = `UPDATE leads SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
  values.push(id);

  const [result] = await pool.query(sql, values);
  return result.affectedRows > 0;
}

module.exports = {
  saveSearch,
  saveLead,
  getAllLeads,
  getLeadsBySearchId,
  getAllSearches,
  updateLeadsStatus,
  getLeadById,
  updateLead
};
