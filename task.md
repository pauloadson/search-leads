# Checklist de Desenvolvimento - Automação de Leads do Google Maps

- `[x]` **Configuração Inicial**
  - `[x]` Inicializar repositório git local
  - `[x]` Criar arquivo `.gitignore`
  - `[x]` Criar `package.json` com dependências (Express, Playwright, MySQL2, Jest, etc.)
  - `[x]` Configurar arquivo `.env.example` e criar `.env` local
  - `[x]` Criar estrutura de pastas do projeto

- `[x]` **Banco de Dados (MySQL)**
  - `[x]` Configurar conexão com o MySQL (`src/config/database.js`)
  - `[x]` Criar queries de inicialização de tabelas (`leads`, `searches`) usando nomenclatura `snake_case` e plural
  - `[x]` Criar serviço de mapeamento e inserção (`src/services/db.service.js`) convertendo `snake_case` (DB) para `camelCase` (API)

- `[x]` **Serviço de Automação (Playwright)**
  - `[x]` Desenvolver o scraper do Google Maps (`src/services/scraper.service.js`)
  - `[x]` Implementar mecanismo de scroll infinito para capturar lista de locais
  - `[x]` Implementar extração detalhada de cada local (Nome, Telefone, Site, Endereço, Categoria, Avaliação)
  - `[x]` Implementar transmissão de progresso via Server-Sent Events (SSE)

- `[x]` **Camada de API (Express Controllers e Rotas)**
  - `[x]` Criar controller para gerenciar leads e buscas (`src/controllers/lead.controller.js`)
  - `[x]` Criar controller para iniciar e parar o scraper (`src/controllers/scraper.controller.js`)
  - `[x]` Definir as rotas da API em `src/routes/api.js` (usando `camelCase` no JSON de resposta/envio)
  - `[x]` Configurar `src/app.js` e `src/index.js`

- `[x]` **Interface Gráfica (Frontend)**
  - `[x]` Criar HTML estrutural (`public/index.html`)
  - `[x]` Criar estilo CSS Premium Dark Mode com Glassmorphism (`public/style.css`)
  - `[x]` Implementar integração em tempo real via JS (`public/app.js`) para capturar progresso do Playwright e baixar CSV

- `[x]` **Testes Automatizados**
  - `[x]` Criar testes unitários para o serviço de banco de dados (`tests/unit/db.service.test.js`)
  - `[x]` Criar testes unitários para os controllers (`tests/unit/lead.controller.test.js`)
  - `[x]` Criar testes de integração para as rotas da API (`tests/integration/api.test.js`)

- `[x]` **Verificação e Entrega**
  - `[x]` Teste manual integrado
  - `[x]` Documentação final de instalação e uso no `README.md`

- `[x]` **Implementação de Paginação**
  - `[x]` Atualizar consultas de banco de dados no `db.service.js` (com contagem de registros, limite e offset)
  - `[x]` Atualizar rotas e controle no `lead.controller.js` (parâmetros `page` e `limit`, retorno estruturado)
  - `[x]` Modificar interface HTML em `public/index.html` (inserir barra de paginação, dropdown de limite e navegação)
  - `[x]` Adicionar estilização CSS em `public/style.css` para os botões e seletores de paginação
  - `[x]` Ajustar lógica de carregamento, navegação e exportação CSV no `public/app.js`
  - `[x]` Ajustar mocks e testes unitários no `tests/unit/db.service.test.js`
  - `[x]` Ajustar mocks e testes unitários no `tests/unit/lead.controller.test.js`
  - `[x]` Ajustar mocks e testes de integração no `tests/integration/api.test.js`
  - `[x]` Executar `npm test` para validar todos os 22 testes
