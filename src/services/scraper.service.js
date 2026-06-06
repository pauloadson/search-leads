/**
 * @fileoverview Serviço responsável pela automação do navegador usando Playwright.
 * Realiza buscas no Google Maps, faz scroll para carregar resultados e extrai dados dos leads.
 */

const { chromium } = require('playwright-chromium');
require('dotenv').config();

// Controladores para permitir cancelamento de buscas ativas
const activeSearches = new Map();

/**
 * Normaliza e limpa números de telefone do formato do Google Maps.
 * @param {string} phoneText - Texto bruto do telefone.
 * @returns {string} Telefone limpo.
 */
function cleanPhone(phoneText) {
  if (!phoneText) return null;
  return phoneText.replace(/[^\d+()-\s]/g, '').trim();
}

/**
 * Inicia o fluxo de scraping de leads no Google Maps.
 * @async
 * @function runScraper
 * @param {Object} params - Parâmetros da busca.
 * @param {number} params.searchId - ID do registro de busca criado no banco.
 * @param {string} params.query - Termo a ser pesquisado.
 * @param {string} params.location - Cidade ou região.
 * @param {number} params.limit - Limite máximo de leads para extrair.
 * @param {Function} params.onProgress - Callback executado a cada atualização de progresso.
 * @returns {Promise<void>}
 */
async function runScraper({ searchId, query, location, limit = 20, onProgress }) {
  const searchKey = `search-${searchId}`;
  const cancelToken = { cancelled: false };
  activeSearches.set(searchKey, cancelToken);

  const headless = process.env.HEADLESS !== 'false';
  let browser = null;

  try {
    onProgress({ status: 'starting', message: 'Iniciando navegador automatizado...' });

    browser = await chromium.launch({
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR'
    });

    const page = await context.newPage();

    // Monta a busca direta do Google Maps
    const searchQuery = `${query} ${location}`;
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    
    onProgress({ status: 'navigating', message: `Acessando o Google Maps para: "${searchQuery}"` });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Espera o carregamento inicial da página
    try {
      await page.waitForSelector('h1', { timeout: 10000 });
    } catch (e) {
      // Se falhar o h1, pode ser que já tenha aberto direto um estabelecimento único
    }

    if (cancelToken.cancelled) return;

    // Verifica se a busca redirecionou direto para uma única página de local
    const currentUrl = page.url();
    if (currentUrl.includes('/maps/place/')) {
      onProgress({ status: 'scraping', message: 'Busca resultou em um estabelecimento direto. Extraindo...' });
      const lead = await scrapeSinglePlacePage(page, searchId);
      if (lead) {
        onProgress({ status: 'lead_found', lead });
      }
      onProgress({ status: 'completed', message: 'Extração concluída.' });
      return;
    }

    // Caso contrário, rola a lista de resultados
    onProgress({ status: 'scrolling', message: 'Carregando lista de estabelecimentos...' });

    const placeLinks = new Set();
    let noNewItemsCount = 0;
    let lastLinksCount = 0;

    // Seletor do painel lateral de resultados do Google Maps
    const feedSelector = 'div[role="feed"]';

    while (placeLinks.size < limit && !cancelToken.cancelled) {
      // Coleta os links atuais de estabelecimentos
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
          .map(a => a.href)
          .filter(href => href && href.includes('/maps/place/'));
      });

      links.forEach(link => {
        if (placeLinks.size < limit) {
          placeLinks.add(link);
        }
      });

      onProgress({ 
        status: 'scrolling', 
        message: `Coletados ${placeLinks.size} links de estabelecimentos. Rolando lista...` 
      });

      if (placeLinks.size >= limit) break;

      // Executa scroll no feed
      const scrollResult = await page.evaluate((selector) => {
        const feed = document.querySelector(selector);
        if (feed) {
          feed.scrollTo(0, feed.scrollHeight);
          return true;
        }
        // Fallback se o container de feed não for encontrado
        window.scrollBy(0, 500);
        return false;
      }, feedSelector);

      // Aguarda o carregamento de mais itens
      await page.waitForTimeout(2000);

      // Verifica se o número de links parou de crescer (fim dos resultados)
      if (placeLinks.size === lastLinksCount) {
        noNewItemsCount++;
        if (noNewItemsCount >= 5) {
          onProgress({ status: 'scrolling', message: 'Fim dos resultados da busca alcançado.' });
          break;
        }
      } else {
        noNewItemsCount = 0;
      }
      lastLinksCount = placeLinks.size;

      // Verifica se a mensagem de fim de resultados apareceu
      const reachedEnd = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        return spans.some(span => 
          span.textContent && (
            span.textContent.includes('Você chegou ao fim da lista') || 
            span.textContent.includes("You've reached the end")
          )
        );
      });

      if (reachedEnd) {
        onProgress({ status: 'scrolling', message: 'Fim dos resultados indicado pelo Google Maps.' });
        break;
      }
    }

    if (cancelToken.cancelled) return;

    const linksArray = Array.from(placeLinks);
    onProgress({ 
      status: 'scraping', 
      message: `Iniciando extração de dados de ${linksArray.length} estabelecimentos...` 
    });

    // Navega em cada link coletado para extrair detalhes
    for (let i = 0; i < linksArray.length; i++) {
      if (cancelToken.cancelled) break;

      const url = linksArray[i];
      onProgress({ 
        status: 'scraping', 
        message: `Extraindo estabelecimento ${i + 1} de ${linksArray.length}...` 
      });

      try {
        const detailPage = await context.newPage();
        // Bloqueia imagens e recursos pesados para acelerar a navegação
        await detailPage.route('**/*', (route) => {
          const resourceType = route.request().resourceType();
          if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
            route.abort();
          } else {
            route.continue();
          }
        });

        await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Pequena espera para os scripts carregarem os dados dinamicamente
        await detailPage.waitForTimeout(1000);

        const lead = await scrapeSinglePlacePage(detailPage, searchId);
        if (lead) {
          lead.googleMapsUrl = url;
          onProgress({ status: 'lead_found', lead });
        }

        await detailPage.close();
      } catch (error) {
        console.error(`Erro ao extrair dados do lead na URL ${url}:`, error.message);
      }
    }

    onProgress({ status: 'completed', message: 'Busca e extração finalizadas com sucesso!' });

  } catch (error) {
    if (!cancelToken.cancelled) {
      console.error('Erro na automação do scraper:', error);
      onProgress({ status: 'failed', message: `Ocorreu um erro: ${error.message}` });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    activeSearches.delete(searchKey);
  }
}

/**
 * Faz o cancelamento de uma busca de leads ativa.
 * @function cancelScraper
 * @param {number} searchId - ID da pesquisa para cancelar.
 * @returns {boolean} Retorna true se a pesquisa foi cancelada.
 */
function cancelScraper(searchId) {
  const searchKey = `search-${searchId}`;
  if (activeSearches.has(searchKey)) {
    const cancelToken = activeSearches.get(searchKey);
    cancelToken.cancelled = true;
    activeSearches.delete(searchKey);
    return true;
  }
  return false;
}

/**
 * Executa a extração dos elementos HTML de detalhes de um local em uma página do Playwright.
 * @async
 * @function scrapeSinglePlacePage
 * @param {import('playwright-chromium').Page} page - A página ativa com o estabelecimento.
 * @param {number} searchId - O ID da busca associada.
 * @returns {Promise<Object|null>} O lead formatado em camelCase ou null se falhar.
 */
async function scrapeSinglePlacePage(page, searchId) {
  try {
    // 1. Extração do Nome (H1)
    let name = '';
    try {
      name = await page.locator('h1').first().innerText({ timeout: 5000 });
      name = name.trim();
    } catch (e) {
      // Se não achar o nome, abortamos porque é o campo obrigatório
      return null;
    }

    if (!name) return null;

    // 2. Classificação Geral (Rating)
    let rating = null;
    try {
      // Classe F7nice costuma conter o rating e contagem no Google Maps pt-br
      const ratingText = await page.locator('div.F7nice span[aria-hidden="true"]').first().innerText({ timeout: 2000 });
      if (ratingText) {
        rating = parseFloat(ratingText.replace(',', '.'));
      }
    } catch (e) {}

    // 3. Contagem de Avaliações (Reviews Count)
    let reviewsCount = 0;
    try {
      const reviewsText = await page.locator('div.F7nice span').nth(1).innerText({ timeout: 2000 });
      if (reviewsText) {
        // Remove parênteses e formatações de milhar
        const count = reviewsText.replace(/[()]/g, '').replace(/\./g, '').trim();
        reviewsCount = parseInt(count, 10) || 0;
      }
    } catch (e) {}

    // 4. Categoria do estabelecimento
    let category = null;
    try {
      category = await page.locator('button[jsaction="pane.rating.category"]').first().innerText({ timeout: 2000 });
      if (category) category = category.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
      try {
        // Fallback de seletor para categoria
        const tempCategory = await page.locator('span.fontBodyMedium').first().innerText({ timeout: 1000 });
        // Filtra para evitar pegar avaliações como categoria (Ex: "4,7 (12)")
        if (tempCategory && !/[0-9]/.test(tempCategory) && !tempCategory.includes('(')) {
          category = tempCategory.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } catch (e2) {}
    }

    // 5. Endereço
    let address = null;
    try {
      // Tenta ler o texto purificado dentro da div .Io6YTe para evitar o ícone do pino
      address = await page.locator('button[data-item-id="address"] .Io6YTe').first().innerText({ timeout: 2000 });
      if (address) address = address.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
      try {
        // Fallback: lê o botão completo e remove o emoji inicial via regex
        let rawAddress = await page.locator('button[data-item-id="address"]').first().innerText({ timeout: 2000 });
        if (rawAddress) {
          address = rawAddress.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
          address = address.replace(/^[^a-zA-Z0-9À-ÿ]+/, '').trim();
        }
      } catch (e2) {}
    }

    // 6. Telefone
    let phone = null;
    try {
      const phoneAttr = await page.locator('button[data-item-id^="phone:tel:"]').first().getAttribute('data-item-id', { timeout: 2000 });
      if (phoneAttr) {
        phone = phoneAttr.replace('phone:tel:', '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
      } else {
        const phoneText = await page.locator('button[data-item-id^="phone:tel:"]').first().innerText({ timeout: 1000 });
        phone = cleanPhone(phoneText);
      }
    } catch (e) {}

    // 7. Site (URL de Autoridade)
    let website = null;
    try {
      const websiteAttr = await page.locator('a[data-item-id="authority"]').first().getAttribute('href', { timeout: 2000 });
      if (websiteAttr) {
        website = websiteAttr.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch (e) {}

    // 8. Instagram
    let instagram = null;
    try {
      const instaAttr = await page.locator('a[href*="instagram.com"]').first().getAttribute('href', { timeout: 2000 });
      if (instaAttr) {
        instagram = instaAttr.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch (e) {}

    // Se o website principal for o Instagram, usa-o
    if (!instagram && website && website.includes('instagram.com')) {
      instagram = website;
    }

    // Garante que o nome também não tenha quebras de linha
    if (name) {
      name = name.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Retorna os dados mapeados para camelCase para a API
    return {
      searchId,
      name,
      phone: phone || null,
      website: website || null,
      address: address || null,
      rating: rating,
      reviewsCount: reviewsCount,
      category: category || null,
      googleMapsUrl: page.url(),
      instagram: instagram || null
    };

  } catch (error) {
    console.error(`Falha ao realizar parse da página do estabelecimento:`, error.message);
    return null;
  }
}

module.exports = {
  runScraper,
  cancelScraper
};
