/**
 * LinkedIn Sales Navigator Scraper
 * 
 * Este ator permite extrair dados do LinkedIn Sales Navigator a partir de links ou keywords.
 * Nota: É necessário ter o cookie at_lt válido do LinkedIn para autenticação.
 */

// Imports atualizados para Apify SDK v3
const Apify = require('apify');
const { Actor } = Apify;
const Crawlee = require('crawlee');
const { PuppeteerCrawler, RequestQueue } = Crawlee;
const { log } = Crawlee.utils;

// Objeto para armazenar seletores CSS importantes
const SELECTORS = {
    SEARCH: {
        SEARCH_INPUT: '.search-global-typeahead__input',
        SEARCH_BUTTON: '.search-global-typeahead__button',
        RESULTS_CONTAINER: '.search-results__container',
    },
    SALES_NAVIGATOR: {
        LEAD_RESULTS: '.search-results__result-item',
        LEAD_NAME: '.result-lockup__name',
        LEAD_TITLE: '.result-lockup__highlight-keyword',
        LEAD_LOCATION: '.result-lockup__misc-item',
        LEAD_COMPANY: '.result-lockup__position-company',
        PAGINATION_NEXT: '.search-results__pagination-next-button',
    },
};

// Atraso aleatório para evitar detecção
const randomDelay = async (min = 2000, max = 5000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
    return delay;
};

// Função principal usando Actor.main()
Actor.main(async () => {
    // Mostra as versões para debug
    console.log('Apify version:', require('apify/package.json').version);
    console.log('Crawlee version:', require('crawlee/package.json').version);
    
    // Recupera os inputs do usuário
    const input = await Actor.getInput();
    
    const {
        linkedinCookies,
        cookieString,
        searchType = 'link', // 'link' ou 'keywords'
        searchUrl,
        searchKeywords,
        maxLeads = 100,
        maxPagesToScrape = 10,
        proxyConfiguration,
    } = input;
    
    // Verificação da disponibilidade de cookies para autenticação
    if (!linkedinCookies && !cookieString) {
        throw new Error('É necessário fornecer cookies válidos do LinkedIn para autenticação (linkedinCookies ou cookieString)!');
    }
    
    // Validação manual de acordo com o tipo de busca - implementada no código já que removemos do INPUT_SCHEMA
    if (searchType === 'link') {
        if (!searchUrl) {
            throw new Error('Você escolheu busca por URL (searchType = "link"), mas o campo searchUrl não foi fornecido.');
        }
    } else if (searchType === 'keywords') {
        if (!searchKeywords) {
            throw new Error('Você escolheu busca por palavras-chave (searchType = "keywords"), mas o campo searchKeywords não foi fornecido.');
        }
    } else {
        throw new Error('searchType inválido. Use "link" ou "keywords".');
    }
    
    // Cria uma fila de requisições
    const requestQueue = await RequestQueue.open();
    
    // Configuração do Proxy (opcional)
    const proxyConfig = proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : undefined;
    
    // Configurações globais para timeouts e limites de recursos
    const NAVIGATION_TIMEOUT = 120000; // 120 segundos (aumentado)
    const DEFAULT_TIMEOUT = 60000; // 60 segundos (aumentado)
    
    // Configure timeouts para navegação
    Crawlee.Configuration.getGlobalConfig().set('requestHandlerTimeoutSecs', 300); // 5 minutos (aumentado)
    
    // Inicia o crawler - com configuração otimizada para usar menos memória
    const crawler = new PuppeteerCrawler({
        requestQueue,
        proxyConfiguration: proxyConfig,
        maxConcurrency: 1,
        launchContext: {
            // Configurações otimizadas para usar menos memória e iniciar mais rápido
            launchOptions: {
                headless: true,
                args: [
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1280,720', // Reduzido para economizar memória
                    '--no-sandbox',
                    '--disable-extensions',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--mute-audio',
                    '--no-zygote', // Evita processos extras
                    '--disable-backgrounding-occluded-windows',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-breakpad',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                    '--disable-ipc-flooding-protection',
                    '--memory-pressure-off',
                    '--js-flags=--max-old-space-size=1024' // Aumentado para 1GB
                ]
            }
        },
        // Desativa carregamento de imagens e folhas de estilo para economizar memória e acelerar
        preNavigationHooks: [
            // Otimização de recursos: bloqueio de recursos que consomem memória
            async ({ page, request }) => {
                log.info(`Otimizando renderização para: ${request.url}`);
                
                // Bloquear recursos desnecessários (imagens, fontes, mídia)
                await page.setRequestInterception(true);
                
                page.on('request', (req) => {
                    const resourceType = req.resourceType();
                    if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
                
                // Configurar timeout para cada requisição individual
                page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
                page.setDefaultTimeout(DEFAULT_TIMEOUT);
            },
            
            // Hooks para evitar detecção
            async ({ page }) => {
                log.info('Aplicando técnicas avançadas anti-detecção...');
                
                // Configurar user agent mais realista
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36');
                
                // Tenta evitar detecção - script mais abrangente
                await page.evaluateOnNewDocument(() => {
                    // Overwrite the 'plugins' property to use a custom getter with plugins reais
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => Array(3).fill().map((_, i) => ({
                            name: `Default Plugin ${i}`,
                            description: 'Gecko default plugin',
                            filename: 'internal-default-plugin',
                            length: 1,
                            item: () => null
                        })),
                    });

                    // Overwrite the 'languages' property
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['pt-BR', 'pt', 'en-US', 'en'],
                    });
                    
                    // Ocultar webdriver
                    const newProto = navigator.__proto__;
                    delete newProto.webdriver;
                    
                    // Adiciona funções de hardware fingerprinting realistas
                    const originalQuery = Element.prototype.querySelectorAll;
                    Element.prototype.querySelectorAll = function(selector) {
                        if (selector === ':target') {
                            return [];
                        }
                        return originalQuery.apply(this, arguments);
                    };
                    
                    // Simular valores de performance aleatórios 
                    // para evitar detecção de timing attacks
                    const randomPerformance = {};
                    Performance.prototype.now = () => {
                        return Date.now() + Math.random() * 10;
                    };
                    
                    // Fingir que é um navegador real
                    window.chrome = {
                        runtime: {},
                        loadTimes: function() {},
                        csi: function() {},
                        app: {},
                    };
                    
                    // Modificar a detecção de canvas fingerprinting
                    const getImageData = CanvasRenderingContext2D.prototype.getImageData;
                    CanvasRenderingContext2D.prototype.getImageData = function() {
                        const imageData = getImageData.apply(this, arguments);
                        const pixels = imageData.data;
                        // Modifica levemente os pixels para evitar fingerprinting
                        for (let i = 0; i < pixels.length; i += 4) {
                            pixels[i] = pixels[i] + (Math.random() < 0.05 ? 1 : 0);
                        }
                        return imageData;
                    };
                });
                
                // Adicionar comportamentos aleatórios para parecer mais humano
                await page.setViewport({
                    width: 1920 + Math.floor(Math.random() * 100),
                    height: 1080 + Math.floor(Math.random() * 100),
                    deviceScaleFactor: 1,
                    hasTouch: false,
                    isLandscape: true,
                    isMobile: false,
                });
            }
        ],
        requestHandler: async ({ page, request }) => {
            log.info(`Processando ${request.url}`);
            
            // Se é a primeira página (autenticação)
            if (request.userData.label === 'AUTHENTICATE') {
                log.info('Autenticando no LinkedIn usando cookies...');
                await authenticateWithCookies(page, linkedinCookies, cookieString);
                
                // Verificando se a autenticação foi bem-sucedida
                log.info('Navegando para LinkedIn feed com timeout estendido...');
                try {
                    // Aumente o timeout para 120 segundos
                    await page.goto('https://www.linkedin.com/feed/', { 
                        waitUntil: 'networkidle2',
                        timeout: 120000 // 120 segundos (aumentado)
                    });
                    
                    // Aguarda até 5 segundos após a navegação para elementos carregarem
                    // Substitui page.waitForTimeout por Promise/setTimeout
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Verifica se está na página do feed ou na página de login
                    const currentUrl = page.url();
                    log.info(`URL atual após navegação: ${currentUrl}`);
                    
                    if (currentUrl.includes('checkpoint') || currentUrl.includes('authwall')) {
                        throw new Error('LinkedIn solicitou verificação adicional. Verifique se os cookies são válidos e recentes.');
                    }
                    
                    // Verifica se o seletor do feed está presente ou se há outro seletor indicando login bem-sucedido
                    const isLoggedIn = await page.evaluate(() => {
                        // Verifica múltiplos seletores que podem indicar login bem-sucedido
                        return Boolean(
                            document.querySelector('.feed-identity-module__actor-meta') || 
                            document.querySelector('.feed-identity-module') ||
                            document.querySelector('.global-nav__me')
                        );
                    });
                    
                    if (!isLoggedIn) {
                        log.warning('Seletores de autenticação não encontrados. Verificando a página...');
                        await page.screenshot({ path: 'auth-check.png', fullPage: true });
                        throw new Error('Falha na autenticação com os cookies fornecidos. Verifique se os cookies são válidos.');
                    }
                    
                    log.info('Seletores de navegação encontrados, autenticação confirmada.');
                    
                } catch (error) {
                    if (error.name === 'TimeoutError') {
                        log.error('Timeout durante a navegação para a página do feed.');
                        // Tente capturar uma screenshot para diagnóstico
                        await page.screenshot({ path: 'timeout-error.png', fullPage: true });
                        throw new Error('Timeout durante a navegação para a página do feed. O LinkedIn pode estar detectando o scraper.');
                    }
                    throw error;
                }
                
                log.info('Autenticação bem-sucedida!');
                
                // Após autenticação, navegue para a URL de pesquisa ou faça pesquisa por keywords
                if (searchType === 'link') {
                    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
                } else {
                    // Navegue para o Sales Navigator e faça pesquisa por keywords
                    await page.goto('https://www.linkedin.com/sales/home', { waitUntil: 'networkidle2' });
                    await searchByKeywords(page, searchKeywords);
                }
                
                // Extrai dados da primeira página de resultados
                const leads = await extractLeadsFromPage(page);
                await Actor.pushData(leads);
                
                // Enfileira próximas páginas para scraping
                await enqueueNextPages(page, requestQueue, maxPagesToScrape);
            } 
            // Se é uma página de resultados subsequente
            else if (request.userData.label === 'SEARCH_RESULTS') {
                log.info(`Extraindo dados da página ${request.userData.pageNumber}`);
                await randomDelay();
                
                // Extrai dados da página atual
                const leads = await extractLeadsFromPage(page);
                if (leads.length > 0) { // Só salva se extraiu algo
                    await Actor.pushData(leads);
                } else {
                    log.warning(`Nenhum lead extraído da página ${request.userData.pageNumber}. Verifique os seletores ou a estrutura da página.`);
                }

                // Verifica se deve prosseguir para a próxima página
                if (request.userData.pageNumber < maxPagesToScrape) {
                    // Verifica se existe botão de próxima página ANTES de esperar
                    const hasNextPage = await page.evaluate((selector) => {
                        const nextButton = document.querySelector(selector);
                        return nextButton && !nextButton.disabled;
                    }, SELECTORS.SALES_NAVIGATOR.PAGINATION_NEXT);

                    if (hasNextPage) {
                        // Adiciona espera aleatória entre 25 e 30 segundos
                        const waitTime = Math.floor(Math.random() * (30000 - 25000 + 1)) + 25000; // 25-30 segundos
                        log.info(`Aguardando ${waitTime / 1000} segundos antes de prosseguir para a página ${request.userData.pageNumber + 1}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        log.info(`Tempo de espera concluído. Tentando enfileirar página ${request.userData.pageNumber + 1}...`);

                        // Enfileira a próxima página
                        await enqueueNextPages(page, requestQueue, maxPagesToScrape, request.userData.pageNumber);
                    } else {
                        log.info(`Não há botão 'próxima página' ativo na página ${request.userData.pageNumber}. Finalizando paginação.`);
                    }
                } else {
                    log.info(`Limite máximo de páginas (${maxPagesToScrape}) atingido.`);
                }
            }
        },
        failedRequestHandler: async ({ request }) => {
            log.error(`Falha ao processar ${request.url}`);
        },
    });
    
    // Enfileira a página inicial para autenticação
    await requestQueue.addRequest({
        url: 'https://www.linkedin.com',
        userData: {
            label: 'AUTHENTICATE',
        },
    });
    
    log.info('Iniciando o crawler...');
    await crawler.run();
    log.info('Crawler finalizado.');
});

/**
 * Função para autenticar no LinkedIn usando cookies
 */
async function authenticateWithCookies(page, linkedinCookies, cookieString) {
    try {
        // Processa os cookies conforme o formato fornecido
        let cookies = [];
        
        if (linkedinCookies && Array.isArray(linkedinCookies)) {
            // Se fornecido como um array de objetos de cookie
            cookies = linkedinCookies.map(cookie => {
                // Cria uma cópia do cookie para não modificar o original
                const cleanCookie = { ...cookie };
                // Remove o atributo sameSite se existir
                delete cleanCookie.sameSite;
                return cleanCookie;
            });
        } else if (cookieString) {
            // Se fornecido como uma string de cookies
            cookies = parseCookieString(cookieString);
        }
        
        // Verifica se o cookie li_at está presente
        const hasAuthCookie = cookies.some(cookie => cookie.name === 'li_at');
        
        if (!hasAuthCookie) {
            log.warning('Cookie de autenticação (li_at) não encontrado. A autenticação pode falhar.');
        }
        
        // Define os cookies no navegador
        await page.setCookie(...cookies);
        log.info(`${cookies.length} cookies definidos com sucesso.`);
    } catch (error) {
        log.error('Erro ao definir cookies:', error);
        throw new Error('Falha ao autenticar com cookies. Verifique o formato dos cookies fornecidos.');
    }
}

/**
 * Função para converter string de cookies em objetos de cookie
 */
function parseCookieString(cookieString) {
    const cookies = [];
    const cookiePairs = cookieString.split(';');
    log.info(`Parsing cookie string: "${cookieString.substring(0, 50)}..."`); // Log inicial

    for (const pair of cookiePairs) {
        if (pair.trim()) {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                const cookieName = name.trim();
                const cookieValue = value.trim();
                log.debug(`  Found cookie pair: ${cookieName}=${cookieValue.substring(0, 10)}...`); // Log para cada par

                // Destaca se é um cookie de autenticação
                if (cookieName === 'at_lt' || cookieName === 'li_at') {
                    log.info(`  -> Found authentication cookie: ${cookieName}`);
                }

                const cookie = {
                    name: cookieName,
                    value: cookieValue,
                    domain: '.linkedin.com',
                    path: '/',
                    httpOnly: cookieName === 'li_at',
                    secure: true
                };
                delete cookie.sameSite;
                cookies.push(cookie);
            }
        }
    }
    log.info(`Parsed ${cookies.length} cookies from string.`);
    return cookies;
}

/**
 * Função para buscar por keywords no Sales Navigator
 */
async function searchByKeywords(page, keywords) {
    try {
        log.info(`Realizando busca por: ${keywords}`);
        
        // Certifique-se de estar no Sales Navigator
        if (!page.url().includes('linkedin.com/sales')) {
            await page.goto('https://www.linkedin.com/sales/home', { waitUntil: 'networkidle2' });
        }
        
        // Aguarda o carregador de página terminar
        await page.waitForFunction(() => !document.querySelector('.artdeco-loader-bars'));
        
        // Usando a barra de pesquisa do Sales Navigator
        await page.waitForSelector(SELECTORS.SEARCH.SEARCH_INPUT, { timeout: 20000 }); // Aumentado
        await randomDelay(500, 1500);
        
        await page.click(SELECTORS.SEARCH.SEARCH_INPUT);
        await randomDelay(300, 800);
        
        // Limpa o campo de pesquisa para garantir
        await page.evaluate((selector) => {
            document.querySelector(selector).value = '';
        }, SELECTORS.SEARCH.SEARCH_INPUT);
        
        // Digite a pesquisa de forma mais humana
        for (const char of keywords) {
            await page.type(SELECTORS.SEARCH.SEARCH_INPUT, char);
            await randomDelay(50, 150);
        }
        
        await randomDelay(500, 1000);
        
        // Pressiona Enter em vez de clicar no botão de pesquisa
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
            page.keyboard.press('Enter'),
        ]);
        
        // Aguarda os resultados carregarem
        await page.waitForSelector(SELECTORS.SALES_NAVIGATOR.LEAD_RESULTS, { timeout: 60000 }); // Aumentado
        
        log.info('Busca realizada com sucesso!');
    } catch (error) {
        log.error('Erro durante a busca:', error);
        
        // Tente capturar uma screenshot para diagnóstico
        try {
            await page.screenshot({ path: 'error-search.png', fullPage: true });
            log.info('Screenshot de erro salvo como error-search.png');
        } catch (e) {
            log.error('Não foi possível salvar screenshot de erro', e);
        }
        
        throw new Error(`Falha ao realizar busca por "${keywords}"`);
    }
}

/**
 * Função para extrair dados de leads da página atual
 */
async function extractLeadsFromPage(page) {
    try {
        log.info('Extraindo leads da página atual...');
        
        // Aguarda o carregamento dos resultados e o desaparecimento do loader
        await page.waitForSelector(SELECTORS.SALES_NAVIGATOR.LEAD_RESULTS);
        await page.waitForFunction(() => !document.querySelector('.artdeco-loader-bars'));
        await randomDelay(1000, 2000);
        
        // Adiciona capturas de informações extras disponíveis no Sales Navigator
        const leads = await page.evaluate((selectors) => {
            const leadElements = document.querySelectorAll(selectors.SALES_NAVIGATOR.LEAD_RESULTS);
            
            return Array.from(leadElements).map(el => {
                const nameElement = el.querySelector(selectors.SALES_NAVIGATOR.LEAD_NAME);
                const titleElement = el.querySelector(selectors.SALES_NAVIGATOR.LEAD_TITLE);
                const locationElement = el.querySelector(selectors.SALES_NAVIGATOR.LEAD_LOCATION);
                const companyElement = el.querySelector(selectors.SALES_NAVIGATOR.LEAD_COMPANY);
                
                // URL do perfil do Sales Navigator
                const profileUrl = nameElement ? nameElement.href : null;
                
                // Extrai o ID do LinkedIn a partir da URL
                let linkedinId = null;
                if (profileUrl && profileUrl.includes('/lead/')) {
                    const matches = profileUrl.match(/\/lead\/([^,]+),/);
                    if (matches && matches[1]) {
                        linkedinId = matches[1];
                    }
                }
                
                // Extrai informações adicionais
                // Captura tags, notas e status de contato se disponíveis
                const tags = Array.from(el.querySelectorAll('.result-lockup__badge-text'))
                    .map(tag => tag.textContent.trim());
                
                // Tenta encontrar outras informações relevantes
                const noteElement = el.querySelector('.result-lockup__annotation');
                const note = noteElement ? noteElement.textContent.trim() : null;
                
                // Verifica status de conexão
                const connectionElement = el.querySelector('.artdeco-entity-lockup__degree');
                const connectionDegree = connectionElement ? connectionElement.textContent.trim() : null;
                
                // Captura informações de contato visíveis
                const emailElement = el.querySelector('[data-anonymize="email"]');
                const phoneElement = el.querySelector('[data-anonymize="phone"]');
                
                return {
                    name: nameElement ? nameElement.textContent.trim() : null,
                    title: titleElement ? titleElement.textContent.trim() : null,
                    location: locationElement ? locationElement.textContent.trim() : null,
                    company: companyElement ? companyElement.textContent.trim() : null,
                    profileUrl,
                    linkedinId,
                    tags: tags.length > 0 ? tags : null,
                    note: note,
                    connectionDegree,
                    email: emailElement ? emailElement.textContent.trim() : null,
                    phone: phoneElement ? phoneElement.textContent.trim() : null,
                    salesNavUrl: profileUrl,
                    timestamp: new Date().toISOString(),
                };
            });
        }, SELECTORS);
        
        log.info(`Extraídos ${leads.length} leads.`);
        return leads;
    } catch (error) {
        log.error('Erro ao extrair leads:', error);
        
        // Tente capturar uma screenshot para diagnóstico
        try {
            await page.screenshot({ path: 'error-extraction.png', fullPage: true });
            log.info('Screenshot de erro salvo como error-extraction.png');
        } catch (e) {
            log.error('Não foi possível salvar screenshot de erro', e);
        }
        
        return [];
    }
}

/**
 * Função para enfileirar próximas páginas para scraping
 */
async function enqueueNextPages(page, requestQueue, maxPages, currentPage = 1) {
    try {
        await randomDelay(1000, 2000);
        
        // Verifica se existe botão de próxima página
        const hasNextPage = await page.evaluate((selector) => {
            const nextButton = document.querySelector(selector);
            return nextButton && !nextButton.disabled;
        }, SELECTORS.SALES_NAVIGATOR.PAGINATION_NEXT);
        
        if (hasNextPage && currentPage < maxPages) {
            log.info(`Enfileirando página ${currentPage + 1} para scraping...`);
            
            // Obtém URL da próxima página
            const nextPageUrl = await page.evaluate((selector) => {
                const nextButton = document.querySelector(selector);
                return nextButton ? nextButton.href : null;
            }, SELECTORS.SALES_NAVIGATOR.PAGINATION_NEXT);
            
            if (nextPageUrl) {
                await requestQueue.addRequest({
                    url: nextPageUrl,
                    userData: {
                        label: 'SEARCH_RESULTS',
                        pageNumber: currentPage + 1,
                    },
                });
                
                log.info(`Página ${currentPage + 1} enfileirada com sucesso.`);
            }
        } else {
            log.info('Não há mais páginas para enfileirar ou atingiu o limite máximo.');
        }
    } catch (error) {
        log.error('Erro ao enfileirar próximas páginas:', error);
        
        // Tente capturar uma screenshot para diagnóstico
        try {
            await page.screenshot({ path: 'error-pagination.png', fullPage: true });
            log.info('Screenshot de erro salvo como error-pagination.png');
        } catch (e) {
            log.error('Não foi possível salvar screenshot de erro', e);
        }
    }
}