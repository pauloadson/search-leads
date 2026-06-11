/**
 * @fileoverview Testes de integração para as rotas da API Express.
 * Utiliza supertest para realizar requisições HTTP simuladas sobre a aplicação.
 */

const request = require('supertest');
const app = require('../../src/app');

// Mock dos serviços para não bater no banco ou abrir o browser de verdade
jest.mock('../../src/services/db.service', () => ({
  getAllLeads: jest.fn(() => Promise.resolve({ leads: [{ id: 1, name: 'Lead Integrado' }], totalItems: 1 })),
  getLeadsBySearchId: jest.fn(() => Promise.resolve({ leads: [], totalItems: 0 })),
  getAllSearches: jest.fn(() => Promise.resolve([{ id: 2, query: 'Sorveteria' }])),
  updateLeadsStatus: jest.fn(() => Promise.resolve()),
  getLeadById: jest.fn(() => Promise.resolve({ id: 1, name: 'Lead Integrado', phone: null })),
  updateLead: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../../src/services/scraper.service', () => ({
  runScraper: jest.fn(),
  cancelScraper: jest.fn(() => true)
}));

jest.mock('../../src/config/database', () => ({
  initializeDatabase: jest.fn(),
  getPool: jest.fn(() => ({
    query: jest.fn(() => Promise.resolve([{ affectedRows: 1 }]))
  }))
}));

describe('Rotas de API - Integração', () => {

  describe('GET /api/leads', () => {
    it('deve responder com status 200 e a lista de leads no formato JSON', async () => {
      const response = await request(app)
        .get('/api/leads')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('leads');
      expect(Array.isArray(response.body.leads)).toBe(true);
      expect(response.body.leads[0].name).toBe('Lead Integrado');
      expect(response.body.totalItems).toBe(1);
    });
  });

  describe('GET /api/searches', () => {
    it('deve responder com status 200 e retornar histórico de buscas', async () => {
      const response = await request(app)
        .get('/api/searches')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].query).toBe('Sorveteria');
    });
  });

  describe('DELETE /api/searches/:id', () => {
    it('deve excluir a busca especificada e retornar status 200', async () => {
      const response = await request(app)
        .delete('/api/searches/2')
        .expect(200);

      expect(response.body.message).toContain('removidos com sucesso');
    });
  });

  describe('POST /api/scraper/cancel', () => {
    it('deve retornar 400 se o searchId não for informado no corpo', async () => {
      await request(app)
        .post('/api/scraper/cancel')
        .send({})
        .expect(400);
    });

    it('deve cancelar a busca e responder com status 200 se o ID for enviado', async () => {
      const response = await request(app)
        .post('/api/scraper/cancel')
        .send({ searchId: 10 })
        .expect(200);

      expect(response.body.message).toContain('cancelada com sucesso');
    });
  });

  describe('GET /docs/', () => {
    it('deve responder com status 200 e retornar a interface HTML do Swagger', async () => {
      await request(app)
        .get('/docs/')
        .expect('Content-Type', /html/)
        .expect(200);
    });
  });

  describe('PUT /api/leads/status', () => {
    it('deve atualizar status dos leads e responder com 200', async () => {
      const response = await request(app)
        .put('/api/leads/status')
        .send({ leadIds: [1, 2], contacted: true, interestStatus: 'interested' })
        .expect(200);

      expect(response.body.message).toContain('atualizado com sucesso');
    });

    it('deve retornar 400 se leadIds não for enviado', async () => {
      await request(app)
        .put('/api/leads/status')
        .send({ contacted: true })
        .expect(400);
    });
  });

  describe('PATCH /api/leads/:id', () => {
    it('deve atualizar o lead e retornar status 200', async () => {
      const response = await request(app)
        .patch('/api/leads/1')
        .send({ phone: '11999999999' })
        .expect(200);

      expect(response.body.message).toContain('atualizado com sucesso');
      expect(response.body.lead.id).toBe(1);
    });

    it('deve retornar status 400 se nenhum dado válido for enviado', async () => {
      await request(app)
        .patch('/api/leads/1')
        .send({ invalidField: 'test' })
        .expect(400);
    });
  });
});
