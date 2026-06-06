# Automação de Leads do Google Maps com Playwright e MySQL

Este plano detalha a criação de uma ferramenta local de extração de leads do Google Maps. A solução contará com um servidor backend em Node.js (usando **Playwright** para automação/scraping e **MySQL** para persistência) e uma interface web moderna, bonita e interativa (HTML/CSS/JS) para configuração, monitoramento em tempo real, consulta do banco e exportação dos dados.

## Comparativo: Playwright vs Puppeteer
Optamos pelo **Playwright** para este projeto pelos seguintes motivos:
1. **Auto-waiting integrado**: O Playwright espera automaticamente que os elementos da interface do Google Maps fiquem visíveis, clicáveis ou estáveis antes de interagir. Isso reduz drasticamente falhas de timing comuns no Puppeteer.
2. **Robustez**: É mantido ativamente pela Microsoft e tem melhor suporte a novas tecnologias do Chromium, ideal para interagir com o Google Maps moderno.
3. **Facilidade**: A sintaxe para gerenciar seletores dinâmicos e scroll de páginas é mais intuitiva que a do Puppeteer.

## Requisitos de Infraestrutura (MySQL)
Para salvar os leads, precisaremos de um banco de dados MySQL ativo.
- Criaremos uma tabela `leads` para registrar as informações capturadas.
- Usaremos um arquivo `.env` para gerenciar as credenciais do MySQL de forma segura.

---

## Proposed Changes

O projeto será estruturado da seguinte forma:

### Backend e Configurações

#### [NEW] [package.json](file:///C:/Users/USER/Desktop/leads-automation/package.json)
Configurações e dependências:
- `express`: Servidor web para APIs e interface gráfica.
- `playwright`: Biblioteca de automação para o scraping do Google Maps.
- `mysql2`: Driver para conectar e executar queries no banco MySQL.
- `dotenv`: Gerenciamento de variáveis de ambiente (credenciais de acesso).
- `cors`: Liberação de requisições de origens diferentes se necessário.

#### [NEW] [.env.example](file:///C:/Users/USER/Desktop/leads-automation/.env.example)
Modelo de configuração para conexão com o banco de dados MySQL:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=leads_db
```

#### [NEW] [server.js](file:///C:/Users/USER/Desktop/leads-automation/server.js)
Servidor Express contendo:
- Inicialização e verificação de tabelas no MySQL.
- Rota API para disparar a automação de busca (passando palavra-chave, cidade, limite de leads).
- A lógica de scraping do Google Maps com Playwright (gerenciamento do browser Chromium, scroll no painel de resultados, clique nos itens e extração).
- Envio das atualizações de progresso e leads em tempo real para o frontend usando **SSE (Server-Sent Events)**.
- Gravação instantânea de cada lead extraído no banco de dados MySQL, prevenindo duplicidade com base no nome/endereço ou link.
- API para listar os leads já salvos no banco de dados e exportá-los.

### Frontend (Interface de Usuário Premium)

#### [NEW] [public/index.html](file:///C:/Users/USER/Desktop/leads-automation/public/index.html)
Estrutura da página da ferramenta:
- Painel de controle para iniciar buscas e configurar parâmetros.
- Status e progresso da pesquisa ativa.
- Tabela com os leads extraídos exibidos em tempo real.
- Visualizador do banco de dados (permite ver buscas passadas e todos os leads já salvos no MySQL).
- Botão de exportação para CSV.
- Console de logs estilizado.

#### [NEW] [public/style.css](file:///C:/Users/USER/Desktop/leads-automation/public/style.css)
Estilização CSS premium (Dark Mode):
- Fundo escuro azulado elegante.
- Cartões com efeito glassmorphism e bordas iluminadas.
- Tabela moderna com estados de hover e transições sutis.
- Console de logs simulando um terminal hacker sofisticado.

#### [NEW] [public/app.js](file:///C:/Users/USER/Desktop/leads-automation/public/app.js)
Interface e eventos de rede:
- Conexão SSE para logs e atualização da tabela ao vivo.
- Requisições HTTP para buscar os leads antigos do MySQL.
- Lógica de exportação para CSV diretamente pelo navegador.

---

## Verification Plan

### Automated Tests
Validação de conexões de banco e carregamento de páginas.

### Manual Verification
1. Criar o banco de dados MySQL (`leads_db`).
2. Configurar as credenciais no arquivo `.env`.
3. Iniciar o servidor com `npm start`.
4. Abrir `http://localhost:3000`.
5. Realizar uma busca de teste e verificar se:
   - O navegador Playwright inicializa e faz a varredura.
   - Os leads aparecem na tela em tempo real.
   - Os dados são inseridos na tabela `leads` do MySQL.
   - É possível recarregar a página e ver os dados persistidos vindo do MySQL.
   - O botão "Exportar CSV" baixa os leads selecionados corretamente.
