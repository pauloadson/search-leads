# Antigravity Leads - Automação do Google Maps

Uma solução completa e local para buscar e extrair leads comerciais no Google Maps. O sistema conta com um robô de automação inteligente em **Playwright**, um backend seguro em **Node.js (Express + MySQL)** e uma interface de usuário moderna e fluida com painel de logs em tempo real e exportação para planilhas CSV.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3 Vanilla (com design responsivo em Dark Mode, transições fluidas e Glassmorphism) e Javascript nativo.
- **Automação (Scraper)**: Playwright (Chromium) para simulação humana, rolagem infinita e leitura assíncrona.
- **Backend (API)**: Node.js com Express para orquestrar requisições e conexões com o banco de dados.
- **Comunicação em Tempo Real**: Server-Sent Events (SSE) para transmissão direta dos logs da varredura e novos leads para o navegador do usuário.
- **Persistência**: MySQL com pooling de conexão e prevenção inteligente contra duplicidade de leads.
- **Testes**: Jest e Supertest para testes unitários e de integração de rotas e services.

---

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:
1. [Node.js](https://nodejs.org/) (Versão 16.x ou superior recomendada).
2. [MySQL Server](https://dev.mysql.com/downloads/installer/) rodando localmente (ou via Docker).

---

## 🚀 Instalação e Configuração

### 1. Clonar ou Acessar a Pasta do Projeto
Se você já está na pasta do projeto, siga para a instalação dos módulos:
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` na raiz do projeto:
```bash
cp .env.example .env
```
Abra o arquivo `.env` e ajuste as configurações do seu banco de dados MySQL:
```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=leads_db

# Se deseja ver o navegador do robô trabalhando na tela, mude para: HEADLESS=false
HEADLESS=true
```
> [!NOTE]  
> Você **não precisa** criar o banco de dados manualmente! Ao iniciar o servidor pela primeira vez, o sistema irá se conectar ao MySQL, criar o banco de dados `leads_db` (ou o nome definido no `.env`) e estruturar as tabelas `searches` e `leads` automaticamente se elas não existirem.

---

## 💻 Como Rodar o Projeto

### Iniciar em Modo de Produção
```bash
npm start
```

### Iniciar em Modo de Desenvolvimento (com auto-reload do Nodemon)
```bash
npm run dev
```

Após iniciar, acesse a interface web em seu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📖 Documentação da API (Swagger / OpenAPI)

A API do backend está totalmente documentada no padrão OpenAPI 3.0. Para testar os endpoints interativamente e ler as descrições de entrada/saída, acesse:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)**

---

## 🧪 Rodando os Testes Automatizados

A aplicação possui testes unitários e de integração completos e isolados (os testes utilizam mocks e não necessitam de um banco MySQL ativo ou navegador real rodando no momento da execução).

Para executar toda a suíte de testes:
```bash
npm test
```

---

## 📂 Estrutura de Pastas

```text
leads-automation/
├── src/
│   ├── config/
│   │   └── database.js      # Pool MySQL e auto-criação de schemas (snake_case)
│   ├── controllers/
│   │   ├── lead.controller.js
│   │   └── scraper.controller.js
│   ├── services/
│   │   ├── db.service.js    # CRUD e mapeamento camelCase <-> snake_case
│   │   └── scraper.service.js # Lógica de automação em Playwright
│   ├── routes/
│   │   └── api.js           # Endpoints HTTP da API
│   ├── app.js               # Configuração Express e middlewares
│   └── index.js             # Entrada e inicialização de processos
├── public/                  # Interface Web da Automação
│   ├── index.html           # Estrutura HTML com abas
│   ├── style.css            # Estilização Glassmorphism Dark Mode
│   └── app.js               # Conexão SSE, renderizadores de DOM e CSV
├── tests/                   # Testes Automatizados
│   ├── unit/
│   │   ├── db.service.test.js
│   │   └── lead.controller.test.js
│   └── integration/
│       └── api.test.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🔄 Fluxo de Nomenclaturas (Requisito Técnico)

Para manter a organização, o projeto segue regras rígidas de nomenclatura:
- **Banco de Dados (MySQL)**: 
  - Nomes de tabelas no **plural** (`searches`, `leads`).
  - Nomes de campos em **snake_case** (Ex: `search_id`, `google_maps_url`, `reviews_count`).
  - Idioma: **Inglês**.
- **API Backend e Client (Frontend)**:
  - Objetos JSON trafegam em **camelCase** (Ex: `searchId`, `googleMapsUrl`, `reviewsCount`).
  - Mapeado bidirecionalmente na camada `db.service.js`.
