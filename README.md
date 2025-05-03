# LinkedIn Sales Navigator Scraper (Versão Atualizada)

Esta é uma versão atualizada e otimizada do LinkedIn Sales Navigator Scraper para Apify, com correções de compatibilidade e otimizações de desempenho.

## Principais Atualizações

- **Correção de Compatibilidade**: Substituído `page.waitForTimeout()` por abordagem compatível com várias versões de Puppeteer
- **Dependências Atualizadas**: Versões mais recentes do Puppeteer e outras dependências
- **Melhorias de Desempenho**: Configurações otimizadas para uso eficiente de memória
- **Timeouts Estendidos**: Valores de timeout aumentados para maior estabilidade
- **Esquema de Input Simplificado**: Maior compatibilidade com a plataforma Apify

## Características

- **Autenticação por Cookie**: Autenticação segura usando cookies do LinkedIn (at_lt/li_at)
- **Duas modalidades de busca**:
  - Por URL: use uma URL do Sales Navigator com filtros pré-configurados
  - Por palavras-chave: busque perfis usando termos específicos
- **Paginação automática**: navegação inteligente entre páginas de resultados
- **Suporte a proxy**: use os proxies da Apify para evitar bloqueios
- **Atrasos aleatórios**: comportamento humano simulado para evitar detecção
- **Extração enriquecida**: captura informações adicionais como tags, grau de conexão e identificadores únicos

## Dados extraídos

Para cada lead, o ator extrai:

- Nome completo
- Cargo/posição atual
- Localização
- Empresa atual
- URL do perfil no Sales Navigator
- ID do LinkedIn (extraído da URL)
- Tags associadas (quando disponíveis)
- Notas e anotações (quando visíveis)
- Grau de conexão
- Informações de contato disponíveis
- Data/hora da extração

## Como usar

### 1. Configure os parâmetros de entrada

| Parâmetro | Descrição |
|-----------|-----------|
| `linkedinCookies` | Array de objetos de cookies do LinkedIn (incluindo at_lt ou li_at) |
| `cookieString` | Alternativa: string de cookies copiada do navegador |
| `searchType` | Escolha entre 'link' ou 'keywords' |
| `searchUrl` | URL completa do Sales Navigator (necessário quando searchType = 'link') |
| `searchKeywords` | Termos de busca (necessário quando searchType = 'keywords') |
| `maxLeads` | Número máximo de leads para extrair (máx. 1000) |
| `maxPagesToScrape` | Número máximo de páginas para extrair (máx. 100) |
| `proxyConfiguration` | Configurações de proxy (recomendado usar os proxies da Apify) |

### 2. Requisitos de sistema no Apify

Este ator realiza tarefas complexas que requerem recursos adequados. Configure sua execução com:

- **Memória**: 4096 MB (4 GB) ou mais para evitar problemas de memória insuficiente
- **Timeout**: 15 minutos ou mais, dependendo de quantas páginas deseja extrair
- **Tipo de instância**: Recomendamos pelo menos 2 vCPU para melhor desempenho

Para configurar estes parâmetros:
1. Vá para "Input" no painel do Apify
2. Clique em "Run options"
3. Ajuste "Memory" para pelo menos 4 GB
4. Ajuste "Timeout" para pelo menos 900 segundos (15 minutos)

### 3. Obtendo os cookies do LinkedIn

Existem duas formas de fornecer os cookies de autenticação:

#### Método 1: Array de objetos de cookies
```javascript
[
  {
    "name": "at_lt", 
    "value": "valor-do-cookie",
    "domain": ".linkedin.com",
    "path": "/",
    "httpOnly": true,
    "secure": true
  }
]
```

#### Método 2: String de cookies (mais simples)
```
at_lt=valor-do-cookie; li_at=valor-do-outro-cookie
```

Para obter os cookies:
1. Faça login na sua conta do LinkedIn
2. Abra as ferramentas de desenvolvedor do navegador (F12)
3. Vá para a aba "Application" ou "Storage" > Cookies
4. Procure pelo cookie `at_lt` ou `li_at`
5. Copie o valor ou a string completa de cookies

### 4. Execute o ator

Após configurar os parâmetros, inicie o ator através da interface da Apify ou programaticamente via API.

### 5. Obtenha os resultados

Os dados extraídos estarão disponíveis em:
- **Dataset**: formato de tabela estruturada (CSV, JSON, Excel)
- **API**: para integração com outros sistemas

## Exemplos

### Exemplo 1: Busca por URL com cookie string

Use este método quando já tiver uma busca configurada no Sales Navigator com todos os filtros desejados:

```json
{
  "cookieString": "at_lt=valor-do-cookie; li_at=valor-do-outro-cookie",
  "searchType": "link",
  "searchUrl": "https://www.linkedin.com/sales/search/people?query=(filters:List((type:GEOGRAPHY,values:List((id:102105699,text:Brasil)))))",
  "maxLeads": 200,
  "maxPagesToScrape": 20,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### Exemplo 2: Busca por palavras-chave com objeto de cookies

Use este método para buscar perfis usando termos específicos:

```json
{
  "linkedinCookies": [
    {
      "name": "at_lt",
      "value": "valor-do-cookie-at_lt",
      "domain": ".linkedin.com",
      "path": "/",
      "httpOnly": true,
      "secure": true
    },
    {
      "name": "li_at",
      "value": "valor-do-cookie-li_at",
      "domain": ".linkedin.com",
      "path": "/",
      "httpOnly": true,
      "secure": true
    }
  ],
  "searchType": "keywords",
  "searchKeywords": "CTO startups tecnologia São Paulo",
  "maxLeads": 100,
  "maxPagesToScrape": 10,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## Notas sobre INPUT_SCHEMA.json

O esquema de entrada foi extremamente simplificado para maior compatibilidade com a plataforma Apify. Na nova versão:

- O campo `linkedinCookies` é um array simples sem definição de subitens (estrutura "items")
- O campo `required` indica apenas que `searchType` é obrigatório
- As validações de tipo de busca (link/keywords) são feitas no código principal
- Ao usar o tipo `link`, você deve fornecer o campo `searchUrl`
- Ao usar o tipo `keywords`, você deve fornecer o campo `searchKeywords`

## Modificações Importantes no Código

### 1. Substituição do `waitForTimeout`

O erro `page.waitForTimeout is not a function` foi corrigido substituindo chamadas como:

```javascript
await page.waitForTimeout(3000);
```

Por uma implementação compatível com todas as versões do Puppeteer:

```javascript
await new Promise(resolve => setTimeout(resolve, 3000));
```

### 2. Aumento de Timeouts

Os timeouts foram aumentados para evitar problemas de tempo limite:

```javascript
// Configurações globais para timeouts
const NAVIGATION_TIMEOUT = 120000; // 120 segundos (aumentado do original de 60s)
const DEFAULT_TIMEOUT = 60000; // 60 segundos (aumentado do original de 30s)

// Tempo limite para manipulador de requisições
Crawlee.Configuration.getGlobalConfig().set('requestHandlerTimeoutSecs', 300); // 5 minutos
```

### 3. Uso de Memória

Foi aumentado o limite de uso de memória JavaScript:

```javascript
'--js-flags=--max-old-space-size=1024' // Aumentado para 1GB
```

## Considerações importantes

1. **Cookies de Autenticação**:
   - O cookie `at_lt` ou `li_at` é essencial para autenticar a sessão
   - Os cookies têm um tempo de vida limitado (geralmente horas ou dias)
   - Atualize os cookies regularmente quando expirados
   - O método de cookie é mais seguro do que usar usuário/senha direto

2. **Limites do LinkedIn**:
   - Respeite os termos de serviço do LinkedIn e mantenha taxas de requisição razoáveis
   - Distribua as execuções ao longo do tempo
   - O LinkedIn tem limites diários de visualização de perfis (variável por conta)

3. **Captchas e Segurança**:
   - Em casos de detecção, o LinkedIn pode apresentar captchas ou outras verificações
   - O ator fará capturas de tela para diagnóstico quando encontrar problemas
   - Os captchas não são resolvidos automaticamente - será necessário intervenção manual

4. **Proxies**:
   - Sempre utilize proxies rotacionados para distribuir as requisições e evitar bloqueios
   - Os proxies da Apify são recomendados por serem otimizados para este tipo de tarefa
   - Considere usar proxies residenciais para maior probabilidade de sucesso

## Problemas comuns e soluções

### Uso de memória e timeouts

Se encontrar erros relacionados a uso excessivo de memória ou timeout:

- **Problema**: "Memory is critically overloaded" ou "The Actor run has reached the timeout"
- **Solução**: 
  1. Aumente a memória disponível nas opções de execução (mínimo 4 GB recomendado)
  2. Aumente o timeout (mínimo 15 minutos recomendado)
  3. Reduza o número de páginas a extrair (`maxPagesToScrape`)

### Autenticação falha 

- **Problema**: "Falha na autenticação com os cookies fornecidos"
- **Solução**: 
  - Verifique se os cookies estão válidos e atualizados
  - Confirme se o cookie `at_lt` ou `li_at` está presente
  - Tente obter novos cookies fazendo login novamente no LinkedIn

### Resultados vazios

- **Problema**: Nenhum lead retornado
- **Solução**:
  - Verifique a URL ou palavras-chave no navegador normal
  - Certifique-se de que sua conta tem acesso ao Sales Navigator
  - Confirme se os cookies foram extraídos corretamente

### Bloqueio pelo LinkedIn

- **Problema**: Detecção e bloqueio pelo LinkedIn
- **Solução**:
  - Aumente os valores de atraso mínimos e máximos no código
  - Utilize proxies de melhor qualidade
  - Reduza a frequência de execução
  - Verifique as capturas de tela de erro para diagnóstico

## Boas Práticas

1. Execute o ator em intervalos moderados (não continuamente)
2. Varie as buscas e termos utilizados
3. Atualize os cookies regularmente
4. Utilize proxies de alta qualidade
5. Configure os atrasos conforme a urgência vs. risco de bloqueio