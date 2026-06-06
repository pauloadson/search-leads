# Walkthrough do Projeto: Paginação de Leads

Implementamos a funcionalidade de paginação configurável na aba de "Banco de Dados" da aplicação **Search Leads** de ponta a ponta (Banco de Dados -> API -> Frontend). Todos os testes unitários e de integração foram devidamente ajustados e estão passando.

---

## 🛠️ Alterações Efetuadas

### 1. Camada de Banco de Dados (`src/services/db.service.js`)
- Alteramos os métodos [getAllLeads](file:///C:/Users/USER/Desktop/leads-automation/src/services/db.service.js#L133) e [getLeadsBySearchId](file:///C:/Users/USER/Desktop/leads-automation/src/services/db.service.js#L161).
- Cada método agora recebe um objeto com opções de paginação (`page`, `limit`) e realiza duas consultas assíncronas ao pool de conexões:
  1. Uma consulta de `COUNT(*)` para totalizar os itens.
  2. Uma consulta com cláusulas `LIMIT` e `OFFSET` para recuperar apenas a fatia correspondente à página selecionada.

### 2. Camada de API (`src/controllers/lead.controller.js`)
- Alteramos o método [getLeads](file:///C:/Users/USER/Desktop/leads-automation/src/controllers/lead.controller.js#L17).
- O controlador lê, valida e padroniza os parâmetros de consulta `page` e `limit`.
- Retorna uma resposta estruturada contendo o array de leads da página e metadados como `totalItems`, `totalPages`, `currentPage` e `limit`.

### 3. Interface HTML e Visual (`public/index.html` e `public/style.css`)
- Inserimos o componente [pagination-controls](file:///C:/Users/USER/Desktop/leads-automation/public/index.html#L202) logo abaixo da tabela de registros.
- O componente exibe um seletor dropdown com as opções de limite de página (`10`, `20`, `50`, `100`), uma etiqueta de status da página (ex: *Pág. 1 de 2*) e botões premium de navegação ("Anterior" e "Próximo").
- Adicionamos regras CSS elegantes no final do arquivo [public/style.css](file:///C:/Users/USER/Desktop/leads-automation/public/style.css#L938) para manter o visual premium Dark Mode com efeitos de hover e estados desabilitados.

### 4. Lógica de Navegação e Exportação (`public/app.js`)
- Criamos variáveis de estado no frontend para gerenciar a paginação (`currentDbPage`, `currentDbLimit`, `totalDbPages`, `totalDbItems`).
- Acoplamos listeners de eventos no seletor de quantidade e botões de navegação para recarregar a lista ativa dinamicamente via AJAX.
- Ajustamos as buscas textuais para sempre resetar o fluxo de dados para a página `1`.
- Ajustamos a lógica de recarregamento após ações de CRM (anotações e status em lote) para manter o usuário na página em que ele se encontrava.
- Melhoramos a exportação de CSV: se o usuário tiver leads marcados nas checkboxes da tabela, exportamos apenas os selecionados. Caso contrário, exportamos os registros exibidos na página atual.

### 5. Suíte de Testes Automatizados (`tests/`)
- Atualizamos os mocks e asserções nos arquivos [tests/unit/db.service.test.js](file:///C:/Users/USER/Desktop/leads-automation/tests/unit/db.service.test.js#L130), [tests/unit/lead.controller.test.js](file:///C:/Users/USER/Desktop/leads-automation/tests/unit/lead.controller.test.js#L34) e [tests/integration/api.test.js](file:///C:/Users/USER/Desktop/leads-automation/tests/integration/api.test.js#L9).
- Todos os testes estão perfeitamente sincronizados com o formato de resposta paginado.

---

## 🧪 Resultados da Suíte de Testes (Jest)

Todos os **22 testes** passaram com êxito:

```text
PASS tests/integration/api.test.js
PASS tests/unit/lead.controller.test.js
PASS tests/unit/db.service.test.js

Test Suites: 3 passed, 3 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        0.753 s, estimated 1 s
Ran all test suites.
```

---

## 🔄 Como Validar Manualmente

1. Suba o servidor com o comando:
   ```bash
   npm run dev
   ```
2. Abra o navegador em **[http://localhost:3000](http://localhost:3000)** e clique na aba **Banco de Dados MySQL**.
3. Escolha uma quantidade menor no dropdown (ex: `10` itens por página) para ver os botões de paginação ficarem ativos se você tiver mais de 10 leads salvos.
4. Navegue pelas páginas usando os botões "Anterior" e "Próximo".
5. Faça buscas textuais e verifique que a barra de paginação recalcula o total de itens e páginas dinamicamente a partir do banco de dados MySQL.
