/**
 * @fileoverview Serviço para gerenciar a automação de envio de mensagens via WhatsApp (Worker).
 */

const dbService = require('./db.service');
const axios = require('axios');

// Configurações da Evolution API
const EVO_URL = process.env.EVO_URL || 'http://localhost:8080';
const EVO_API_KEY = process.env.AUTHENTICATION_API_KEY || 'sua_api_key_aqui';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'leads_bot';

function formatPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');
  // Remove zero à esquerda (ex: 062 -> 62)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  // Se for DDD + Número (10 ou 11 dígitos), adiciona o 55 do Brasil
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

async function sendMessage(phone, text, typingDelaySeconds) {
  try {
    const formatted = formatPhone(phone);
    await axios.post(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      number: formatted,
      options: {
        delay: (typingDelaySeconds || 0) * 1000,
        presence: "composing"
      },
      textMessage: {
        text: text
      }
    }, {
      headers: { 'apikey': EVO_API_KEY }
    });
    return { success: true };
  } catch (error) {
    let errorMessage = error.message;
    if (error.response && error.response.data) {
      if (error.response.data.response && error.response.data.response.message) {
        errorMessage = JSON.stringify(error.response.data.response.message);
      } else if (error.response.data.message) {
        errorMessage = JSON.stringify(error.response.data.message);
      }
    }
    console.error(`[WhatsApp] Erro ao enviar MSG para ${phone}: ${errorMessage}`);
    
    // Identifica se o erro é de número inexistente
    if (errorMessage.includes('"exists":false') || errorMessage.includes('exists: false')) {
      return { success: false, errorType: 'invalid_number' };
    }
    return { success: false, errorType: 'unknown' };
  }
}

let isRunning = false;
let shouldStop = false;
let currentStatus = {
  processed: 0,
  total: 0,
  sent: 0,
  invalid: 0,
  errors: 0,
  status: 'idle'
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Retorna um tempo com variação aleatória de X% para mais ou para menos.
 * Ex: base = 10s, variação = 30%. Retorna entre 7s e 13s.
 */
function getRandomDelay(baseSeconds, variancePercentage = 30) {
  const min = baseSeconds * (1 - variancePercentage / 100);
  const max = baseSeconds * (1 + variancePercentage / 100);
  // Retorna o valor em segundos com casas decimais se necessário
  return (Math.random() * (max - min) + min).toFixed(2);
}

/**
 * Inicia a campanha de envio de mensagens em lote.
 */
async function startCampaign({ batchSize, typingDelay, messageDelay, filterContacted, templateMessage }) {
  if (isRunning) throw new Error("A campanha já está em andamento.");
  
  isRunning = true;
  shouldStop = false;
  currentStatus = { processed: 0, total: batchSize, sent: 0, invalid: 0, errors: 0, status: 'running' };

  try {
    // contactedParam: 0 (Não Contatados), 1 (Já Contatados), ou null (Todos)
    let contactedParam = null;
    if (filterContacted === 'nao_contatados') contactedParam = 0;
    if (filterContacted === 'contatados') contactedParam = 1;
    
    // Busca os leads usando a paginação para limitar pelo tamanho do lote (batchSize)
    const { leads } = await dbService.getAllLeads({
      contacted: contactedParam,
      excludeInactive: true,
      requirePhone: true,
      limit: batchSize,
      page: 1
    });

    if (leads.length === 0) {
      currentStatus.status = 'finished';
      isRunning = false;
      return;
    }

    currentStatus.total = leads.length;

    for (const lead of leads) {
      if (shouldStop) {
        currentStatus.status = 'stopped';
        break;
      }

      // Evita tentar enviar se não houver telefone (pode ser útil filtrar isso direto no banco no futuro)
      if (!lead.phone) {
        currentStatus.processed += 1;
        continue;
      }

      // Preparar mensagem dinâmica (suporta {nome} e {name})
      const message = templateMessage.replace(/{nome}|{name}/gi, lead.name || '');

      console.log(`[WhatsApp Worker] Iniciando envio para ${lead.name} (${lead.phone})...`);

      // 1. Aplicar randomização no tempo de digitação (varia até 30%)
      const actualTypingDelay = getRandomDelay(typingDelay, 30);

      // Ação de Envio
      console.log(`[WhatsApp Worker] 🟢 Simulando digitação (${actualTypingDelay}s) e enviando para ${lead.phone}`);
      const result = await sendMessage(lead.phone, message, actualTypingDelay);

      if (result.success) {
        // 3. Atualizar status do lead no banco para evitar reenvio
        await dbService.updateLead(lead.id, { contacted: true });
        currentStatus.processed += 1;
        currentStatus.sent += 1;
      } else {
        if (result.errorType === 'invalid_number') {
          console.log(`[WhatsApp Worker] 🔴 Número inválido no WhatsApp: ${lead.phone}. Marcando como Inativo.`);
          await dbService.updateLead(lead.id, { interestStatus: 'inactive' });
          currentStatus.invalid += 1;
        } else {
          console.log(`[WhatsApp Worker] 🔴 Falha ao enviar para ${lead.phone}.`);
          currentStatus.errors += 1;
        }
        currentStatus.processed += 1; // Incrementa mesmo com erro para não travar
      }

      // 4. Delay entre as mensagens (não aplica no último lead do lote se for parar)
      if (currentStatus.processed < leads.length && !shouldStop) {
        // Variação de até 40% no intervalo entre mensagens para parecer mais humano
        const actualMessageDelay = getRandomDelay(messageDelay, 40);
        console.log(`[WhatsApp Worker] ⏱️ Pausa de ${actualMessageDelay} segundos antes do próximo lead...`);
        await delay(actualMessageDelay * 1000);
      }
    }

    if (!shouldStop) {
      currentStatus.status = 'finished';
      console.log(`[WhatsApp Worker] ✅ Lote finalizado com sucesso!`);
    }
  } catch (error) {
    console.error("[WhatsApp Worker] Erro na campanha:", error);
    currentStatus.status = 'error';
  } finally {
    isRunning = false;
  }
}

/**
 * Solicita a parada da campanha em andamento.
 */
function stopCampaign() {
  if (!isRunning) return false;
  shouldStop = true;
  console.log(`[WhatsApp Worker] 🛑 Solicitação de parada recebida. Encerrando após a ação atual...`);
  return true;
}

/**
 * Retorna o status atual do worker.
 */
function getStatus() {
  return {
    isRunning,
    ...currentStatus
  };
}

module.exports = {
  startCampaign,
  stopCampaign,
  getStatus
};
