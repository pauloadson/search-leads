/**
 * @fileoverview Testes unitários para o controlador de dados de leads (lead.controller.js).
 */

// Mocks
jest.mock('../../src/services/db.service');
jest.mock('../../src/config/database', () => {
  const queryMock = jest.fn();
  return {
    getPool: jest.fn(() => ({
      query: queryMock
    })),
    _queryMock: queryMock
  };
});

const leadController = require('../../src/controllers/lead.controller');
const dbService = require('../../src/services/db.service');
const { _queryMock } = require('../../src/config/database');

describe('Controlador de Leads (lead.controller)', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {}, params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('getLeads', () => {
    it('deve listar todos os leads se nenhum searchId for fornecido', async () => {
      const mockLeads = [
        { id: 1, name: 'Lead 1', phone: '123' },
        { id: 2, name: 'Lead 2', phone: '456' }
      ];
      dbService.getAllLeads.mockResolvedValue({ leads: mockLeads, totalItems: 2 });

      await leadController.getLeads(req, res);

      expect(dbService.getAllLeads).toHaveBeenCalledWith({
        searchTerm: undefined,
        page: 1,
        limit: 50
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        leads: mockLeads,
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 50
      });
    });

    it('deve listar leads filtrando por searchId se fornecido na query', async () => {
      const mockLeads = [{ id: 1, name: 'Lead 1', phone: '123', searchId: 5 }];
      req.query.searchId = '5';
      dbService.getLeadsBySearchId.mockResolvedValue({ leads: mockLeads, totalItems: 1 });

      await leadController.getLeads(req, res);

      expect(dbService.getLeadsBySearchId).toHaveBeenCalledWith(5, {
        searchTerm: undefined,
        page: 1,
        limit: 50
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        leads: mockLeads,
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        limit: 50
      });
    });

    it('deve listar leads filtrando por searchId e termo de busca se fornecidos na query', async () => {
      const mockLeads = [{ id: 1, name: 'Lead 1', phone: '123', searchId: 5 }];
      req.query.searchId = '5';
      req.query.search = 'teste';
      dbService.getLeadsBySearchId.mockResolvedValue({ leads: mockLeads, totalItems: 1 });

      await leadController.getLeads(req, res);

      expect(dbService.getLeadsBySearchId).toHaveBeenCalledWith(5, {
        searchTerm: 'teste',
        page: 1,
        limit: 50
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        leads: mockLeads,
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        limit: 50
      });
    });

    it('deve retornar status 500 se o serviço lançar um erro', async () => {
      dbService.getAllLeads.mockRejectedValue(new Error('Erro no banco'));

      await leadController.getLeads(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno ao recuperar leads do banco de dados.' });
    });
  });

  describe('getSearches', () => {
    it('deve retornar a lista de pesquisas históricas com sucesso', async () => {
      const mockSearches = [{ id: 10, query: 'Restaurantes', location: 'Natal' }];
      dbService.getAllSearches.mockResolvedValue(mockSearches);

      await leadController.getSearches(req, res);

      expect(dbService.getAllSearches).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockSearches);
    });
  });

  describe('deleteSearch', () => {
    it('deve excluir uma pesquisa histórica com sucesso e retornar status 200', async () => {
      req.params.id = '12';
      // Simula affectedRows > 0 (registro deletado)
      _queryMock.mockResolvedValue([{ affectedRows: 1 }]);

      await leadController.deleteSearch(req, res);

      expect(_queryMock).toHaveBeenCalledWith('DELETE FROM searches WHERE id = ?', [12]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Pesquisa e leads associados removidos com sucesso.' });
    });

    it('deve retornar status 404 se a pesquisa a ser excluída não existir', async () => {
      req.params.id = '999';
      _queryMock.mockResolvedValue([{ affectedRows: 0 }]);

      await leadController.deleteSearch(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pesquisa não encontrada.' });
    });
  });

  describe('updateStatus', () => {
    it('deve atualizar o status dos leads com sucesso e retornar status 200', async () => {
      req.body = { leadIds: [1, 2], contacted: true, interestStatus: 'interested', notes: 'Ligamos' };
      dbService.updateLeadsStatus.mockResolvedValue();

      await leadController.updateStatus(req, res);

      expect(dbService.updateLeadsStatus).toHaveBeenCalledWith([1, 2], {
        contacted: true,
        interestStatus: 'interested',
        notes: 'Ligamos'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Status dos leads atualizado com sucesso.' });
    });

    it('deve retornar status 400 se leadIds não for enviado ou não for array', async () => {
      req.body = { contacted: true };

      await leadController.updateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'O campo "leadIds" deve ser um array não vazio.' });
    });
  });

  describe('updateLead', () => {
    it('deve retornar status 400 se ID do lead não for numérico ou inválido', async () => {
      req.params.id = 'abc';
      req.body = { phone: '123' };

      await leadController.updateLead(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'ID do lead inválido.' });
    });

    it('deve retornar status 404 se o lead não for encontrado', async () => {
      req.params.id = '99';
      req.body = { phone: '123' };
      dbService.getLeadById.mockResolvedValue(null);

      await leadController.updateLead(req, res);

      expect(dbService.getLeadById).toHaveBeenCalledWith(99);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Lead não encontrado.' });
    });

    it('deve retornar status 400 se nenhum campo válido para atualização for fornecido', async () => {
      req.params.id = '5';
      req.body = { invalidField: 'abc' };
      dbService.getLeadById.mockResolvedValue({ id: 5, name: 'Lead Teste' });

      await leadController.updateLead(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Nenhum campo válido para atualização foi fornecido.' });
    });

    it('deve atualizar o lead com sucesso e retornar status 200 com o lead atualizado', async () => {
      req.params.id = '5';
      req.body = { phone: '11999999999', instagram: 'http://inst' };
      
      const existingLead = { id: 5, name: 'Lead Teste', phone: null };
      const updatedLead = { id: 5, name: 'Lead Teste', phone: '11999999999', instagram: 'http://inst' };
      
      dbService.getLeadById
        .mockResolvedValueOnce(existingLead)
        .mockResolvedValueOnce(updatedLead);
      
      dbService.updateLead.mockResolvedValue(true);

      await leadController.updateLead(req, res);

      expect(dbService.updateLead).toHaveBeenCalledWith(5, {
        phone: '11999999999',
        instagram: 'http://inst'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Lead atualizado com sucesso.',
        lead: updatedLead
      });
    });
  });
});
