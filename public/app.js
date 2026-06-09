/**
 * @fileoverview Lógica do cliente frontend. Controla a interação com os endpoints da API,
 * manipulação do DOM, conexão Server-Sent Events (SSE) e exportação de CSV.
 */

// Estado global do frontend
let eventSource = null;
let currentSearchId = null;
let currentScrapedLeads = [];
let currentSavedLeads = [];
let activeTab = 'scraper'; // 'scraper' ou 'database'
let activeLeadForNotes = null; // ID do lead selecionado para editar notas

// Estado de Paginação do Banco
let currentDbPage = 1;
let currentDbLimit = 50;
let totalDbPages = 1;
let totalDbItems = 0;

// Elementos do DOM - Geral
const tabScraperBtn = document.getElementById('tab-scraper-btn');
const tabDatabaseBtn = document.getElementById('tab-database-btn');
const tabMessagesBtn = document.getElementById('tab-messages-btn');
const tabScraper = document.getElementById('tab-scraper');
const tabDatabase = document.getElementById('tab-database');
const tabMessages = document.getElementById('tab-messages');

// Elementos do DOM - Scraper (Automação)
const scraperForm = document.getElementById('scraper-form');
const inputQuery = document.getElementById('input-query');
const inputLocation = document.getElementById('input-location');
const inputLimit = document.getElementById('input-limit');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const consoleLogs = document.getElementById('console-logs');
const btnClearConsole = document.getElementById('btn-clear-console');
const tableRealtime = document.getElementById('table-realtime').querySelector('tbody');
const scrapedCounter = document.getElementById('scraped-counter');
const btnExportRealtime = document.getElementById('btn-export-realtime');

// Elementos do DOM - Banco de Dados / CRM
const searchesList = document.getElementById('searches-list');
const tableSaved = document.getElementById('table-saved').querySelector('tbody');
const savedCounter = document.getElementById('saved-counter');
const btnExportSaved = document.getElementById('btn-export-saved');
const savedLeadsTitle = document.getElementById('saved-leads-title');
const savedLeadsSubtitle = document.getElementById('saved-leads-subtitle');
const chkSelectAllSaved = document.getElementById('chk-select-all-saved');
const crmBatchActions = document.getElementById('crm-batch-actions');
const btnBatchContacted = document.getElementById('btn-batch-contacted');
const btnBatchInterested = document.getElementById('btn-batch-interested');
const btnBatchUninterested = document.getElementById('btn-batch-uninterested');
const btnBatchInactive = document.getElementById('btn-batch-inactive');
const inputSearchDb = document.getElementById('input-search-db');
const filterContacted = document.getElementById('filter-contacted');
const filterInterest = document.getElementById('filter-interest');

// Elementos DOM de Paginação
const selectPageLimit = document.getElementById('select-page-limit');
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const paginationStatusText = document.getElementById('pagination-status-text');

// Elementos do DOM - Modal de Notas
const notesModal = document.getElementById('notes-modal');
const btnCloseNotesModal = document.getElementById('btn-close-notes-modal');
const btnCancelNotes = document.getElementById('btn-cancel-notes');
const btnSaveNotes = document.getElementById('btn-save-notes');
const notesLeadName = document.getElementById('notes-lead-name');
const notesLeadInfo = document.getElementById('notes-lead-info');
const notesTextarea = document.getElementById('notes-textarea');

/* ==========================================================================
   Inicialização e Navegação
   ========================================================================== */
// Template Padrão de Mensagem
const DEFAULT_TEMPLATE = `Olá pessoal da {name}, tudo bem?

Me chamo Paulo adson e vim através do Google Maps. Gostaria de saber mais sobre os serviços de vocês.

Aguardo retorno!`;

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa ícones do Lucide
  lucide.createIcons();
  
  // Limpa o input de busca ao carregar
  if (inputSearchDb) inputSearchDb.value = '';

  // Registra eventos de abas
  tabScraperBtn.addEventListener('click', () => switchTab('scraper'));
  tabDatabaseBtn.addEventListener('click', () => switchTab('database'));
  tabMessagesBtn.addEventListener('click', () => switchTab('messages'));
  
  // Registra eventos do formulário e console
  scraperForm.addEventListener('submit', handleStartSearch);
  btnStop.addEventListener('click', handleCancelSearch);
  btnClearConsole.addEventListener('click', () => {
    consoleLogs.innerHTML = '<div class="log-line system">[SISTEMA] Console limpo.</div>';
  });

  // Registra eventos de exportação
  btnExportRealtime.addEventListener('click', () => exportCSV(currentScrapedLeads, `leads-${inputQuery.value.trim().toLowerCase()}-${inputLocation.value.trim().toLowerCase()}.csv`));
  btnExportSaved.addEventListener('click', () => {
    const activeSearch = document.querySelector('.search-item.active');
    const filename = activeSearch 
      ? `leads-saved-${activeSearch.dataset.query}-${activeSearch.dataset.location}.csv`
      : 'leads-saved-todos.csv';
    
    // Se houver itens selecionados via checkbox, exporta apenas eles
    const checkboxes = Array.from(tableSaved.querySelectorAll('.lead-select-chk:checked'));
    if (checkboxes.length > 0) {
      const selectedIds = checkboxes.map(chk => parseInt(chk.dataset.id, 10));
      const selectedLeads = currentSavedLeads.filter(lead => selectedIds.includes(lead.id));
      exportCSV(selectedLeads, filename);
    } else {
      exportCSV(currentSavedLeads, filename);
    }
  });

  // Registra eventos de CRM e seleção em lote
  chkSelectAllSaved.addEventListener('change', handleSelectAllSaved);
  btnBatchContacted.addEventListener('click', () => updateBatchStatus({ contacted: true }));
  btnBatchInterested.addEventListener('click', () => updateBatchStatus({ interestStatus: 'interested' }));
  btnBatchUninterested.addEventListener('click', () => updateBatchStatus({ interestStatus: 'not_interested' }));
  btnBatchInactive.addEventListener('click', () => updateBatchStatus({ interestStatus: 'inactive' }));

  // Evento de busca textual com debounce de 400ms (reseta página para 1)
  let searchDebounceTimeout = null;
  inputSearchDb.addEventListener('input', () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      const activeSearch = document.querySelector('.search-item.active');
      const term = inputSearchDb.value.trim();

      if (activeSearch && activeSearch.id !== 'search-item-all') {
        loadLeadsBySearch(activeSearch.dataset.id, activeSearch.dataset.query, activeSearch.dataset.location, term, 1);
      } else {
        loadAllSavedLeads(term, 1);
      }
    }, 400);
  });

  // Evento de mudança nos filtros de contatado/interesse
  if (filterContacted) {
    filterContacted.addEventListener('change', () => {
      currentDbPage = 1;
      reloadActiveLeadsList();
    });
  }

  if (filterInterest) {
    filterInterest.addEventListener('change', () => {
      currentDbPage = 1;
      reloadActiveLeadsList();
    });
  }

  // Eventos do seletor e botões de Paginação
  if (selectPageLimit) {
    selectPageLimit.addEventListener('change', () => {
      currentDbLimit = parseInt(selectPageLimit.value, 10) || 50;
      currentDbPage = 1;
      reloadActiveLeadsList();
    });
  }

  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (currentDbPage > 1) {
        currentDbPage--;
        reloadActiveLeadsList();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      if (currentDbPage < totalDbPages) {
        currentDbPage++;
        reloadActiveLeadsList();
      }
    });
  }

  // Eventos de Fechamento do Modal
  btnCloseNotesModal.addEventListener('click', hideNotesModal);
  btnCancelNotes.addEventListener('click', hideNotesModal);
  btnSaveNotes.addEventListener('click', handleSaveLeadNotes);
});

/**
 * Controla a alternância de exibição entre as abas.
 * @param {string} tab - Nome da aba alvo ('scraper' ou 'database').
 */
function switchTab(tab) {
  activeTab = tab;
  
  // Remove classes active de todas as abas e botões
  tabScraperBtn.classList.remove('active');
  tabDatabaseBtn.classList.remove('active');
  tabMessagesBtn.classList.remove('active');
  tabScraper.classList.remove('active');
  tabDatabase.classList.remove('active');
  tabMessages.classList.remove('active');

  if (tab === 'scraper') {
    tabScraperBtn.classList.add('active');
    tabScraper.classList.add('active');
  } else if (tab === 'database') {
    tabDatabaseBtn.classList.add('active');
    tabDatabase.classList.add('active');
    if (inputSearchDb) inputSearchDb.value = ''; // Limpa busca
    if (filterContacted) filterContacted.value = 'all'; // Reseta filtro
    if (filterInterest) filterInterest.value = 'all'; // Reseta filtro
    currentDbPage = 1;
    if (selectPageLimit) selectPageLimit.value = '50';
    currentDbLimit = 50;
    loadSearchesHistory();
    loadAllSavedLeads('', 1); // Carrega todos por padrão ao abrir
  } else if (tab === 'messages') {
    tabMessagesBtn.classList.add('active');
    tabMessages.classList.add('active');
    loadMessagesTab();
  }
}

/* ==========================================================================
   Console / Log Utils
   ========================================================================== */
/**
 * Adiciona uma linha de mensagem colorida no console do terminal.
 * @param {string} text - Mensagem a exibir.
 * @param {string} type - Tipo de log ('system', 'info', 'success', 'error', 'warning').
 */
function addLog(text, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = document.createElement('div');
  logLine.className = `log-line ${type}`;
  logLine.innerHTML = `<span class="log-time">[${timestamp}]</span> ${text}`;
  consoleLogs.appendChild(logLine);
  
  // Rola o terminal para o final
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

/* ==========================================================================
   Automação do Scraper (SSE)
   ========================================================================== */
/**
 * Manipula a submissão do formulário para iniciar o scraper.
 * Abre a conexão SSE com o backend.
 * @param {Event} e - Evento de submit do formulário.
 */
function handleStartSearch(e) {
  e.preventDefault();

  const query = inputQuery.value.trim();
  const location = inputLocation.value.trim();
  const limit = parseInt(inputLimit.value, 10) || 10;

  // Limpa estados e tela
  currentScrapedLeads = [];
  tableRealtime.innerHTML = '';
  scrapedCounter.textContent = '0 Leads';
  btnExportRealtime.disabled = true;

  addLog(`[SISTEMA] Iniciando requisição para: "${query}" em "${location}" (limite: ${limit})`, 'system');

  // Alterna botões na interface
  btnStart.classList.add('hidden');
  btnStop.classList.remove('hidden');

  // Monta URL de EventSource
  const url = `/api/scraper/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=${limit}`;
  
  // Inicia conexão SSE
  eventSource = new EventSource(url);

  // 1. Escuta início da busca
  eventSource.addEventListener('search_started', (event) => {
    const data = JSON.parse(event.data);
    currentSearchId = data.searchId;
    addLog(`Busca registrada no MySQL com ID: ${currentSearchId}`, 'success');
  });

  // 2. Escuta logs e progresso de scraping
  eventSource.addEventListener('log', (event) => {
    const data = JSON.parse(event.data);
    let type = 'info';
    if (data.status === 'starting' || data.status === 'navigating') type = 'system';
    if (data.status === 'scrolling') type = 'warning';
    addLog(data.message, type);
  });

  // 3. Escuta leads encontrados em tempo real
  eventSource.addEventListener('lead_found', (event) => {
    const lead = JSON.parse(event.data);
    currentScrapedLeads.push(lead);
    
    // Incrementa contadores
    scrapedCounter.textContent = `${currentScrapedLeads.length} Leads`;
    btnExportRealtime.disabled = false;

    // Adiciona na tabela
    addLeadToTable(tableRealtime, lead, true);
    addLog(`Lead capturado: **${lead.name}** - Tel: ${lead.phone || 'N/A'}`, 'success');
  });

  // 4. Escuta conclusão com sucesso
  eventSource.addEventListener('completed', (event) => {
    const data = JSON.parse(event.data);
    addLog(`[SUCESSO] ${data.message}`, 'success');
    closeSSE();
  });

  // 5. Escuta falhas
  eventSource.addEventListener('failed', (event) => {
    const data = JSON.parse(event.data);
    addLog(`[FALHA] ${data.message}`, 'error');
    closeSSE();
  });

  // Evento genérico de erro na conexão
  eventSource.onerror = (err) => {
    console.error('Erro na conexão EventSource:', err);
    addLog('Conexão SSE interrompida ou encerrada pelo servidor.', 'warning');
    closeSSE();
  };
}

/**
 * Fecha a conexão SSE ativa e restaura os botões da interface.
 */
function closeSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  btnStart.classList.remove('hidden');
  btnStop.classList.add('hidden');
}

/**
 * Aciona o cancelamento do scraper ativo chamando a API do backend.
 */
async function handleCancelSearch() {
  if (!currentSearchId) return;
  
  addLog('Solicitando interrupção da automação...', 'warning');

  try {
    const response = await fetch('/api/scraper/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ searchId: currentSearchId })
    });

    const data = await response.json();
    if (response.ok) {
      addLog('Automação interrompida com sucesso pelo usuário.', 'error');
    } else {
      addLog(`Não foi possível interromper: ${data.error}`, 'warning');
    }
  } catch (error) {
    addLog(`Erro ao tentar parar busca: ${error.message}`, 'error');
  } finally {
    closeSSE();
  }
}

/* ==========================================================================
   Preenchimento de Tabelas do DOM
   ========================================================================== */
/**
 * Renderiza uma linha de lead em uma tabela.
 * @param {HTMLTableSectionElement} tbody - O corpo da tabela onde a linha será injetada.
 * @param {Object} lead - Dados do lead em camelCase.
 * @param {boolean} isRealtimeTable - Flag que define se é a tabela em tempo real (para estilização).
 */
function addLeadToTable(tbody, lead, isRealtimeTable = false) {
  // Remove a linha vazia se existir
  const emptyRow = tbody.querySelector('.empty-row');
  if (emptyRow) {
    tbody.removeChild(emptyRow);
  }

  const tr = document.createElement('tr');
  tr.dataset.id = lead.id;

  // Se for a tabela salva (CRM), aplica estilos baseados no status de interesse
  if (!isRealtimeTable) {
    if (lead.interestStatus === 'interested') {
      tr.className = 'lead-interested';
    } else if (lead.interestStatus === 'not_interested') {
      tr.className = 'lead-uninterested';
    } else if (lead.interestStatus === 'inactive') {
      tr.className = 'lead-inactive';
    }
  }

  // Formata a avaliação
  const ratingText = lead.rating 
    ? `${lead.rating} ★ (${lead.reviewsCount || 0})` 
    : 'N/A';

  // Cria site link
  const websiteCell = lead.website
    ? `<a href="${lead.website}" target="_blank" class="table-link"><i data-lucide="external-link"></i> Acessar</a>`
    : '<span class="text-muted">Nenhum</span>';

  // Cria Instagram link
  const instagramCell = lead.instagram
    ? `<a href="${lead.instagram}" target="_blank" class="table-link"><i data-lucide="instagram"></i> Instagram</a>`
    : '<span class="text-muted">Nenhum</span>';

  // Cria Maps link
  const mapsCell = lead.googleMapsUrl
    ? `<a href="${lead.googleMapsUrl}" target="_blank" class="table-link" title="Ver no Google Maps"><i data-lucide="map"></i></a>`
    : '';

  // Cria Phone link clicável para cópia rápida
  const phoneCell = lead.phone
    ? `<span class="clickable-phone" title="Clique para copiar telefone">${lead.phone}</span>`
    : '<span class="text-muted">Nenhum</span>';

  if (isRealtimeTable) {
    // Tabela em tempo real (8 colunas)
    const realtimeActionCell = `
      <div style="display: flex; gap: 8px;">
        ${mapsCell}
        <button class="btn-action-icon btn-copy-message success-hover" title="Copiar mensagem personalizada">
          <i data-lucide="copy"></i>
        </button>
      </div>
    `;
    tr.innerHTML = `
      <td class="lead-name" title="${lead.name}"><strong>${lead.name}</strong></td>
      <td>${phoneCell}</td>
      <td>${websiteCell}</td>
      <td>${instagramCell}</td>
      <td>${lead.category || '<span class="text-muted">N/A</span>'}</td>
      <td>${ratingText}</td>
      <td title="${lead.address || ''}">${lead.address || '<span class="text-muted">N/A</span>'}</td>
      <td>${realtimeActionCell}</td>
    `;

    // Vincula evento para copiar
    const btnCopy = tr.querySelector('.btn-copy-message');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => copyCustomMessageForLead(lead));
    }

    // Vincula evento para copiar o telefone
    const phoneSpan = tr.querySelector('.clickable-phone');
    if (phoneSpan) {
      phoneSpan.addEventListener('click', () => copyPhoneNumber(lead.phone, lead.name));
    }
  } else {
    // Tabela do Banco de Dados / CRM (10 colunas)
    // 1. Badge de interesse
    let badgeClass = 'badge-pending';
    let badgeText = 'Pendente';
    if (lead.interestStatus === 'interested') {
      badgeClass = 'badge-interested';
      badgeText = 'Interessado';
    } else if (lead.interestStatus === 'not_interested') {
      badgeClass = 'badge-uninterested';
      badgeText = 'Sem Interesse';
    } else if (lead.interestStatus === 'inactive') {
      badgeClass = 'badge-inactive';
      badgeText = 'Inativo';
    }

    const contactedBadge = lead.contacted 
      ? `<div class="badge-contacted"><i data-lucide="check-check" style="width: 10px; height: 10px;"></i> Contatado</div>` 
      : '';

    const statusCell = `
      <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
        <span class="badge ${badgeClass}">${badgeText}</span>
        ${contactedBadge}
      </div>
    `;

    // 2. Ações customizadas (Cópia de mensagem + Notas CRM + Maps)
    const actionCell = `
      <div style="display: flex; gap: 8px;">
        ${mapsCell}
        <button class="btn-action-icon btn-copy-message success-hover" title="Copiar mensagem personalizada">
          <i data-lucide="copy"></i>
        </button>
        <button class="btn-action-icon btn-edit-notes" title="Anotações CRM" data-id="${lead.id}">
          <i data-lucide="file-text"></i>
        </button>
      </div>
    `;

    tr.innerHTML = `
      <td class="text-center"><input type="checkbox" class="lead-select-chk" data-id="${lead.id}"></td>
      <td class="lead-name" title="${lead.name}"><strong>${lead.name}</strong></td>
      <td>${phoneCell}</td>
      <td>${websiteCell}</td>
      <td>${instagramCell}</td>
      <td>${lead.category || '<span class="text-muted">N/A</span>'}</td>
      <td>${ratingText}</td>
      <td title="${lead.address || ''}">${lead.address || '<span class="text-muted">N/A</span>'}</td>
      <td>${statusCell}</td>
      <td>${actionCell}</td>
    `;

    // Vincula evento de clique no checkbox da linha
    const chk = tr.querySelector('.lead-select-chk');
    chk.addEventListener('change', updateBatchActionsVisibility);

    // Vincula evento para abrir anotações
    const btnNotes = tr.querySelector('.btn-edit-notes');
    btnNotes.addEventListener('click', () => showNotesModal(lead));

    // Vincula evento para copiar mensagem
    const btnCopy = tr.querySelector('.btn-copy-message');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => copyCustomMessageForLead(lead));
    }

    // Vincula evento para copiar o telefone
    const phoneSpan = tr.querySelector('.clickable-phone');
    if (phoneSpan) {
      phoneSpan.addEventListener('click', () => copyPhoneNumber(lead.phone, lead.name));
    }
  }

  tbody.appendChild(tr);
  
  // Recria os ícones do Lucide
  lucide.createIcons({
    attrs: {
      style: 'width: 14px; height: 14px;'
    }
  });
}

/* ==========================================================================
   Banco de Dados MySQL - Consultas e Exclusões
   ========================================================================== */
/**
 * Busca e renderiza o histórico de pesquisas.
 */
async function loadSearchesHistory() {
  try {
    const response = await fetch('/api/searches');
    const searches = await response.json();

    searchesList.innerHTML = '';

    if (searches.length === 0) {
      searchesList.innerHTML = '<div class="empty-text">Nenhuma busca realizada.</div>';
      return;
    }

    // Adiciona botão "Todos os Leads" no topo
    const allItem = document.createElement('div');
    allItem.className = 'search-item active';
    allItem.id = 'search-item-all';
    allItem.innerHTML = `
      <div class="search-item-info">
        <span class="term">Mostrar Todos os Leads</span>
        <span class="details">Todos os registros persistidos</span>
      </div>
      <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
    `;
    allItem.addEventListener('click', () => {
      document.querySelectorAll('.search-item').forEach(i => i.classList.remove('active'));
      allItem.classList.add('active');
      if (inputSearchDb) inputSearchDb.value = ''; // Limpa busca anterior
      if (filterContacted) filterContacted.value = 'all'; // Reseta filtro
      if (filterInterest) filterInterest.value = 'all'; // Reseta filtro
      loadAllSavedLeads('', 1);
    });
    searchesList.appendChild(allItem);

    // Renderiza cada busca do histórico
    searches.forEach(search => {
      const dateText = new Date(search.createdAt).toLocaleString('pt-BR');
      
      const item = document.createElement('div');
      item.className = 'search-item';
      item.dataset.id = search.id;
      item.dataset.query = search.query;
      item.dataset.location = search.location;

      item.innerHTML = `
        <div class="search-item-info">
          <span class="term" title="${search.query}">${search.query}</span>
          <span class="details">${search.location} - ${dateText}</span>
        </div>
        <button class="btn-action-icon danger btn-delete-search" title="Excluir busca e leads">
          <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
      `;

      // Evento de clique no item para listar leads
      item.addEventListener('click', (e) => {
        // Evita abrir busca se clicar em excluir
        if (e.target.closest('.btn-delete-search')) return;

        document.querySelectorAll('.search-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (inputSearchDb) inputSearchDb.value = ''; // Limpa busca anterior
        if (filterContacted) filterContacted.value = 'all'; // Reseta filtro
        if (filterInterest) filterInterest.value = 'all'; // Reseta filtro
        loadLeadsBySearch(search.id, search.query, search.location, '', 1);
      });

      // Evento de clique para excluir histórico
      const deleteBtn = item.querySelector('.btn-delete-search');
      deleteBtn.addEventListener('click', () => deleteSearchHistory(search.id, search.query));

      searchesList.appendChild(item);
    });

    lucide.createIcons();
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
  }
}

/**
 * Recarrega a listagem de leads ativa na página atual do banco.
 */
function reloadActiveLeadsList() {
  const activeSearch = document.querySelector('.search-item.active');
  const term = inputSearchDb.value.trim();

  if (activeSearch && activeSearch.id !== 'search-item-all') {
    loadLeadsBySearch(activeSearch.dataset.id, activeSearch.dataset.query, activeSearch.dataset.location, term, currentDbPage);
  } else {
    loadAllSavedLeads(term, currentDbPage);
  }
}

/**
 * Atualiza o painel inferior de paginação (botões e texto descritivo).
 */
function updatePaginationUI() {
  if (paginationStatusText) {
    paginationStatusText.textContent = `Pág. ${currentDbPage} de ${totalDbPages} (${totalDbItems} total)`;
  }

  if (btnPrevPage) {
    btnPrevPage.disabled = currentDbPage <= 1;
  }
  if (btnNextPage) {
    btnNextPage.disabled = currentDbPage >= totalDbPages;
  }
}

/**
 * Carrega todos os leads já cadastrados no MySQL com filtro de pesquisa opcional e paginação.
 * @async
 * @param {string} [search] - Termo para filtro de busca.
 * @param {number} [page] - Página a ser carregada.
 */
async function loadAllSavedLeads(search = '', page = 1) {
  try {
    currentDbPage = page;
    savedLeadsTitle.textContent = 'Todos os Leads Salvos';
    tableSaved.innerHTML = '<tr><td colspan="10" class="text-center">Carregando registros...</td></tr>';
    
    const contacted = filterContacted ? filterContacted.value : 'all';
    const interestStatus = filterInterest ? filterInterest.value : 'all';
    const response = await fetch(`/api/leads?search=${encodeURIComponent(search)}&contacted=${contacted}&interestStatus=${interestStatus}&page=${page}&limit=${currentDbLimit}`);
    const data = await response.json();
    
    const leads = data.leads || [];
    totalDbItems = data.totalItems || 0;
    totalDbPages = data.totalPages || 1;
    currentDbPage = data.currentPage || page;

    currentSavedLeads = leads;
    tableSaved.innerHTML = '';
    savedCounter.textContent = `${totalDbItems} Registros`;

    if (leads.length === 0) {
      tableSaved.innerHTML = '<tr class="empty-row"><td colspan="10" class="text-center">Nenhum lead encontrado.</td></tr>';
      btnExportSaved.disabled = true;
      updatePaginationUI();
      return;
    }

    leads.forEach(lead => addLeadToTable(tableSaved, lead));
    btnExportSaved.disabled = false;
    updatePaginationUI();
  } catch (error) {
    console.error('Erro ao carregar todos os leads:', error);
    tableSaved.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Erro ao carregar dados do MySQL.</td></tr>';
  }
}

/**
 * Carrega leads associados a uma busca específica com filtro de pesquisa opcional e paginação.
 * @param {number} searchId - ID da busca no histórico.
 * @param {string} query - Termo pesquisado.
 * @param {string} location - Local pesquisado.
 * @param {string} [search] - Termo para filtro de busca.
 * @param {number} [page] - Página a ser carregada.
 */
async function loadLeadsBySearch(searchId, query, location, search = '', page = 1) {
  try {
    currentDbPage = page;
    savedLeadsTitle.textContent = `Leads: "${query}"`;
    savedLeadsSubtitle.textContent = `Resultados em ${location}`;
    tableSaved.innerHTML = '<tr><td colspan="10" class="text-center">Carregando registros...</td></tr>';
    
    const contacted = filterContacted ? filterContacted.value : 'all';
    const interestStatus = filterInterest ? filterInterest.value : 'all';
    const response = await fetch(`/api/leads?searchId=${searchId}&search=${encodeURIComponent(search)}&contacted=${contacted}&interestStatus=${interestStatus}&page=${page}&limit=${currentDbLimit}`);
    const data = await response.json();
    
    const leads = data.leads || [];
    totalDbItems = data.totalItems || 0;
    totalDbPages = data.totalPages || 1;
    currentDbPage = data.currentPage || page;

    currentSavedLeads = leads;
    tableSaved.innerHTML = '';
    savedCounter.textContent = `${totalDbItems} Registros`;

    if (leads.length === 0) {
      tableSaved.innerHTML = '<tr class="empty-row"><td colspan="10" class="text-center">Nenhum lead encontrado nesta pesquisa.</td></tr>';
      btnExportSaved.disabled = true;
      updatePaginationUI();
      return;
    }

    leads.forEach(lead => addLeadToTable(tableSaved, lead));
    btnExportSaved.disabled = false;
    updatePaginationUI();
  } catch (error) {
    console.error(`Erro ao carregar leads para busca ${searchId}:`, error);
    tableSaved.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Erro ao carregar leads da busca.</td></tr>';
  }
}

/**
 * Deleta uma pesquisa e seus leads do banco MySQL.
 * @param {number} id - ID da pesquisa.
 * @param {string} query - Nome do termo pesquisado para exibição do modal.
 */
async function deleteSearchHistory(id, query) {
  const confirmDelete = confirm(`Deseja realmente excluir a pesquisa por "${query}" e TODOS os seus leads associados?`);
  if (!confirmDelete) return;

  try {
    const response = await fetch(`/api/searches/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      // Recarrega lista
      loadSearchesHistory();
      // Volta para listagem geral
      loadAllSavedLeads();
    } else {
      const data = await response.json();
      alert(`Falha ao excluir: ${data.error}`);
    }
  } catch (error) {
    console.error('Erro na requisição de deleção:', error);
    alert('Erro de rede ao tentar excluir.');
  }
}

/* ==========================================================================
   Utilitário de Exportação para CSV (Universal)
   ========================================================================== */
/**
 * Converte um array de objetos leads (camelCase) em arquivo CSV estruturado e inicia o download.
 * @param {Array<Object>} leads - Array contendo os leads.
 * @param {string} filename - Nome do arquivo resultante do download.
 */
function exportCSV(leads, filename) {
  if (!leads || leads.length === 0) return;

  // Define os cabeçalhos das colunas
  const headers = [
    'Nome',
    'Telefone',
    'Website',
    'Instagram',
    'Categoria',
    'Classificacao',
    'Contagem Avaliacoes',
    'Endereco',
    'URL Google Maps'
  ];

  // Converte os registros para strings CSV seguras (escapa aspas duplas)
  const csvRows = [
    headers.join(',') // Primeira linha: cabeçalho
  ];

  leads.forEach(lead => {
    const row = [
      escapeCSV(lead.name),
      escapeCSV(lead.phone),
      escapeCSV(lead.website),
      escapeCSV(lead.instagram),
      escapeCSV(lead.category),
      lead.rating !== null ? lead.rating : '',
      lead.reviewsCount !== null ? lead.reviewsCount : '0',
      escapeCSV(lead.address),
      escapeCSV(lead.googleMapsUrl)
    ];
    csvRows.push(row.join(','));
  });

  // Cria o blob e dispara o download (Usa UTF-8 com BOM para Excel ler acentuações em português correto)
  const csvString = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Escapa strings para garantir que o formato CSV permaneça válido.
 * Coloca as strings entre aspas e duplica aspas existentes.
 * @param {string} val - Valor bruto.
 * @returns {string} String escapada.
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let formatted = String(val).trim();
  // Se contiver vírgula, quebras de linha ou aspas, precisa ser encapsulado em aspas duplas
  if (formatted.includes(',') || formatted.includes('\n') || formatted.includes('"')) {
    formatted = formatted.replace(/"/g, '""'); // Duplica aspas duplas
    return `"${formatted}"`;
  }
  return `"${formatted}"`;
}

/* ==========================================================================
   Lógica CRM: Seleção em Lote, Atualização de Status e Modal de Notas
   ========================================================================== */
/**
 * Alterna a seleção de todos os checkboxes na tabela de salvos.
 */
function handleSelectAllSaved() {
  const isChecked = chkSelectAllSaved.checked;
  const checkboxes = tableSaved.querySelectorAll('.lead-select-chk');
  checkboxes.forEach(chk => chk.checked = isChecked);
  updateBatchActionsVisibility();
}

/**
 * Controla a exibição ou ocultação dos botões de ação em lote no cabeçalho.
 */
function updateBatchActionsVisibility() {
  const checkboxes = Array.from(tableSaved.querySelectorAll('.lead-select-chk'));
  const anyChecked = checkboxes.some(chk => chk.checked);

  if (anyChecked) {
    crmBatchActions.classList.remove('hidden');
  } else {
    crmBatchActions.classList.add('hidden');
    chkSelectAllSaved.checked = false;
  }
}

/**
 * Atualiza o status em lote de múltiplos leads selecionados.
 * @async
 * @param {Object} updateData - Campos a serem atualizados (Ex: { contacted: true }).
 */
async function updateBatchStatus(updateData) {
  const checkboxes = Array.from(tableSaved.querySelectorAll('.lead-select-chk:checked'));
  const leadIds = checkboxes.map(chk => parseInt(chk.dataset.id, 10));

  if (leadIds.length === 0) return;

  try {
    const response = await fetch('/api/leads/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ leadIds, ...updateData })
    });

    if (response.ok) {
      // Oculta painel de lote
      crmBatchActions.classList.add('hidden');
      chkSelectAllSaved.checked = false;

      // Recarrega a tabela ativa mantendo a página
      reloadActiveLeadsList();
    } else {
      const data = await response.json();
      alert(`Erro ao atualizar status: ${data.error}`);
    }
  } catch (error) {
    console.error('Erro na requisição PUT de status:', error);
    alert('Erro de conexão ao atualizar status.');
  }
}

/**
 * Abre o modal de anotações do lead carregando seus dados.
 * @param {Object} lead - Dados do lead.
 */
function showNotesModal(lead) {
  activeLeadForNotes = lead.id;
  notesLeadName.textContent = lead.name;
  notesLeadInfo.textContent = `${lead.phone || 'Sem telefone'} / ${lead.category || 'Sem Categoria'}`;
  notesTextarea.value = lead.notes || '';
  
  notesModal.classList.remove('hidden');
  notesTextarea.focus();
}

/**
 * Oculta o modal de anotações do lead.
 */
function hideNotesModal() {
  notesModal.classList.add('hidden');
  activeLeadForNotes = null;
  notesTextarea.value = '';
}

/**
 * Salva as anotações do lead ativo no banco de dados.
 * @async
 */
async function handleSaveLeadNotes() {
  if (!activeLeadForNotes) return;

  const notesText = notesTextarea.value.trim();

  try {
    const response = await fetch('/api/leads/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        leadIds: [activeLeadForNotes],
        notes: notesText || null
      })
    });

    if (response.ok) {
      hideNotesModal();

      // Recarrega a tabela ativa mantendo a página
      reloadActiveLeadsList();
    } else {
      const data = await response.json();
      alert(`Erro ao salvar notas: ${data.error}`);
    }
  } catch (error) {
    console.error('Erro ao salvar notas:', error);
    alert('Erro de rede ao salvar notas.');
  }
}

/* ==========================================================================
   Lógica de Templates de Mensagem e Toasts
   ========================================================================== */

/**
 * Carrega a aba de mensagens, definindo o texto do template e a pré-visualização.
 */
function loadMessagesTab() {
  const templateText = document.getElementById('template-text');
  const currentTemplate = getMessageTemplate();
  templateText.value = currentTemplate;
  updateMessagePreview();

  // Garante os binds dos cliques das tags (apenas uma vez para evitar múltiplos listeners)
  setupTemplateTabEventListeners();
}

/**
 * Obtém o template de mensagem configurado, ou o padrão caso não exista.
 * @returns {string} O template de mensagem.
 */
function getMessageTemplate() {
  return localStorage.getItem('search_leads_msg_template') || DEFAULT_TEMPLATE;
}

/**
 * Salva o template de mensagem no localStorage.
 * @param {string} text - O texto do template.
 */
function saveMessageTemplate(text) {
  localStorage.setItem('search_leads_msg_template', text);
}

/**
 * Substitui os marcadores de tags pelos dados dinâmicos do lead.
 * Se um campo opcional estiver em branco/Nulo, removemos qualquer
 * string de tag que sobrou ou limpamos o texto para não ficar feio.
 * @param {string} template - O template de mensagem.
 * @param {Object} lead - Os dados do lead.
 * @returns {string} Mensagem formatada.
 */
function formatMessage(template, lead) {
  let msg = template;
  
  // Mapeamento de tags para os campos correspondentes
  const replacements = {
    '{name}': lead.name || '',
    '{phone}': lead.phone || '',
    '{website}': lead.website || '',
    '{instagram}': lead.instagram || '',
    '{category}': lead.category || '',
    '{address}': lead.address || ''
  };
  
  // Substitui cada marcador no texto
  for (const [tag, val] of Object.entries(replacements)) {
    msg = msg.replaceAll(tag, val);
  }
  
  return msg;
}

/**
 * Atualiza a caixa de pré-visualização na aba de mensagens com dados mock.
 */
function updateMessagePreview() {
  const templateText = document.getElementById('template-text');
  const previewBox = document.querySelector('.preview-box');
  if (!templateText || !previewBox) return;

  const dummyLead = {
    name: 'Empresa Exemplo Ltda',
    phone: '(11) 99999-9999',
    website: 'https://www.empresaexemplo.com.br',
    instagram: 'https://instagram.com/empresaexemplo',
    category: 'Restaurante',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP'
  };

  previewBox.textContent = formatMessage(templateText.value, dummyLead);
}

/**
 * Configura os listeners específicos da aba de templates de mensagem (formulário, reset, tags).
 */
let templateListenersInitialized = false;
function setupTemplateTabEventListeners() {
  if (templateListenersInitialized) return;

  const templateText = document.getElementById('template-text');
  const messageTemplateForm = document.getElementById('message-template-form');
  const btnResetTemplate = document.getElementById('btn-reset-template');
  const tagButtons = document.querySelectorAll('.btn-tag');

  // Input listener para live-preview
  templateText.addEventListener('input', updateMessagePreview);

  // Form submit para salvar
  messageTemplateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveMessageTemplate(templateText.value);
    showToast('Salvo!', 'Template de mensagem atualizado com sucesso.', 'success');
  });

  // Botão restaurar padrão
  btnResetTemplate.addEventListener('click', () => {
    if (confirm('Deseja realmente restaurar a mensagem padrão? Suas alterações salvas serão perdidas.')) {
      templateText.value = DEFAULT_TEMPLATE;
      saveMessageTemplate(DEFAULT_TEMPLATE);
      updateMessagePreview();
      showToast('Restaurado!', 'Template de mensagem padrão restaurado.', 'info');
    }
  });

  // Botões de tags rápidas
  tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      const startPos = templateText.selectionStart;
      const endPos = templateText.selectionEnd;
      const text = templateText.value;

      // Insere a tag na posição atual do cursor
      templateText.value = text.substring(0, startPos) + tag + text.substring(endPos, text.length);

      // Posiciona o cursor logo após a tag
      const newCursorPos = startPos + tag.length;
      templateText.selectionStart = newCursorPos;
      templateText.selectionEnd = newCursorPos;
      
      templateText.focus();
      updateMessagePreview();
    });
  });

  templateListenersInitialized = true;
}

/**
 * Copia a mensagem gerada e personalizada com os dados do lead para o clipboard.
 * @param {Object} lead - Objeto com os dados do lead.
 */
async function copyCustomMessageForLead(lead) {
  const template = getMessageTemplate();
  const formattedMsg = formatMessage(template, lead);

  try {
    await navigator.clipboard.writeText(formattedMsg);
    showToast(
      'Copiado!', 
      `Mensagem personalizada para "${lead.name}" copiada com sucesso.`, 
      'success'
    );
  } catch (err) {
    console.error('Falha ao usar Clipboard API, tentando fallback...', err);

    // Fallback para navegadores sem HTTPS ou suporte (ex: execCommand)
    const textarea = document.createElement('textarea');
    textarea.value = formattedMsg;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast(
          'Copiado!', 
          `Mensagem personalizada para "${lead.name}" copiada.`, 
          'success'
        );
      } else {
        alert('Não foi possível copiar a mensagem de forma automática.');
      }
    } catch (fallbackErr) {
      console.error('Falha no fallback de cópia:', fallbackErr);
      alert('Erro ao copiar a mensagem.');
    }
    
    document.body.removeChild(textarea);
  }
}

/**
 * Exibe um banner toast na tela.
 * @param {string} title - Título do toast.
 * @param {string} message - Corpo da mensagem.
 * @param {string} type - Tipo de toast ('success' | 'info').
 */
function showToast(title, message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check' : 'info';

  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  
  // Recria ícones para renderizar Lucide corretamente
  lucide.createIcons({
    attrs: {
      style: 'width: 14px; height: 14px;'
    }
  });

  // Esconde e deleta o toast depois de 4 segundos
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, 4000);
}

/**
 * Copia o número de telefone do lead para a área de transferência.
 * @param {string} phone - O número de telefone.
 * @param {string} leadName - O nome do lead.
 */
async function copyPhoneNumber(phone, leadName) {
  if (!phone) return;

  try {
    await navigator.clipboard.writeText(phone);
    showToast(
      'Telefone Copiado!', 
      `O telefone de "${leadName}" foi copiado para a área de transferência.`, 
      'success'
    );
  } catch (err) {
    console.error('Falha ao usar Clipboard API para o telefone, tentando fallback...', err);

    const textarea = document.createElement('textarea');
    textarea.value = phone;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast(
          'Telefone Copiado!', 
          `O telefone de "${leadName}" foi copiado.`, 
          'success'
        );
      } else {
        alert('Não foi possível copiar o telefone automaticamente.');
      }
    } catch (fallbackErr) {
      console.error('Falha no fallback de cópia de telefone:', fallbackErr);
      alert('Erro ao copiar o telefone.');
    }
    
    document.body.removeChild(textarea);
  }
}

