/**
 * @fileoverview Testes unitários para o serviço de banco de dados (db.service.js).
 * Utiliza mocks para evitar conexões de rede com banco de dados MySQL de verdade durante testes.
 */

// Mock do módulo de conexão de banco de dados
jest.mock('../../src/config/database', () => {
  const queryMock = jest.fn();
  const getPoolMock = jest.fn(() => ({
    query: queryMock,
    getConnection: jest.fn(() => ({
      beginTransaction: jest.fn(),
      query: queryMock,
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    }))
  }));
  return {
    initializeDatabase: jest.fn(),
    getPool: getPoolMock,
    _queryMock: queryMock // expõe para os testes resetarem/configurarem retornos
  };
});

const dbService = require('../../src/services/db.service');
const { _queryMock } = require('../../src/config/database');

describe('Serviço de Banco de Dados (db.service)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveSearch', () => {
    it('deve registrar uma nova pesquisa e retornar o ID inserido', async () => {
      // Configura retorno mockado do insert
      _queryMock.mockResolvedValue([{ insertId: 42 }]);

      const searchParams = { query: 'Dentistas', location: 'São Paulo' };
      const searchId = await dbService.saveSearch(searchParams);

      expect(_queryMock).toHaveBeenCalledTimes(1);
      expect(_queryMock).toHaveBeenCalledWith(
        'INSERT INTO searches (query, location) VALUES (?, ?)',
        ['Dentistas', 'São Paulo']
      );
      expect(searchId).toBe(42);
    });
  });

  describe('getAllSearches', () => {
    it('deve retornar a lista de pesquisas formatada em camelCase', async () => {
      const dbRows = [
        { id: 1, query: 'Pizzaria', location: 'Campinas', created_at: '2026-06-05T00:00:00.000Z' },
        { id: 2, query: 'Academia', location: 'Santos', created_at: '2026-06-05T01:00:00.000Z' }
      ];
      _queryMock.mockResolvedValue([dbRows]);

      const searches = await dbService.getAllSearches();

      expect(_queryMock).toHaveBeenCalledTimes(1);
      expect(searches).toHaveLength(2);
      expect(searches[0]).toEqual({
        id: 1,
        query: 'Pizzaria',
        location: 'Campinas',
        createdAt: '2026-06-05T00:00:00.000Z'
      });
      expect(searches[1]).toEqual({
        id: 2,
        query: 'Academia',
        location: 'Santos',
        createdAt: '2026-06-05T01:00:00.000Z'
      });
    });
  });

  describe('saveLead', () => {
    it('deve inserir um novo lead e retornar os dados contendo o ID gerado', async () => {
      _queryMock.mockResolvedValue([{ insertId: 100 }]);

      const leadData = {
        searchId: 1,
        name: 'Clínica Sorria',
        phone: '11999999999',
        website: 'https://sorria.com',
        address: 'Rua das Flores, 123',
        rating: 4.8,
        reviewsCount: 150,
        category: 'Clínica Dentária',
        googleMapsUrl: 'https://maps.google.com/123',
        instagram: 'https://instagram.com/clinicasorria'
      };

      const savedLead = await dbService.saveLead(leadData);

      expect(_queryMock).toHaveBeenCalledTimes(1);
      expect(savedLead).toEqual({
        ...leadData,
        id: 100
      });
    });

    it('deve buscar o ID existente se o lead for duplicado (ON DUPLICATE KEY gerou insertId = 0)', async () => {
      // Mock do INSERT retornando insertId = 0 (linhas atualizadas ou sem alteração física)
      _queryMock.mockResolvedValueOnce([{ insertId: 0 }]);
      // Mock do SELECT para buscar o ID correto da linha existente
      _queryMock.mockResolvedValueOnce([[{ id: 99 }]]);

      const leadData = {
        searchId: 1,
        name: 'Clínica Sorria',
        phone: '11999999999',
        website: 'https://sorria.com',
        address: 'Rua das Flores, 123'
      };

      const savedLead = await dbService.saveLead(leadData);

      expect(_queryMock).toHaveBeenCalledTimes(2);
      expect(_queryMock).toHaveBeenLastCalledWith(
        'SELECT id FROM leads WHERE name = ? AND address = ?',
        ['Clínica Sorria', 'Rua das Flores, 123']
      );
      expect(savedLead.id).toBe(99);
    });
  });

  describe('getAllLeads', () => {
    it('deve retornar a lista de leads e totalItems mapeados corretamente de snake_case para camelCase', async () => {
      const dbRows = [
        {
          id: 50,
          search_id: 2,
          name: 'Pizzaria Bella',
          phone: '1933333333',
          website: 'http://bella.com',
          address: 'Av Central, 500',
          rating: '4.50', // MySQL retorna decimal como string
          reviews_count: 85,
          category: 'Restaurante',
          google_maps_url: 'http://maps.google.com/500',
          instagram: 'http://instagram.com/bella',
          created_at: '2026-06-05T02:00:00.000Z'
        }
      ];
      _queryMock.mockResolvedValueOnce([[{ total: 1 }]]);
      _queryMock.mockResolvedValueOnce([dbRows]);

      const { leads, totalItems } = await dbService.getAllLeads();

      expect(_queryMock).toHaveBeenCalledTimes(2);
      expect(totalItems).toBe(1);
      expect(leads).toHaveLength(1);
      expect(leads[0]).toEqual({
        id: 50,
        searchId: 2,
        name: 'Pizzaria Bella',
        phone: '1933333333',
        website: 'http://bella.com',
        address: 'Av Central, 500',
        rating: 4.5,
        reviewsCount: 85,
        category: 'Restaurante',
        googleMapsUrl: 'http://maps.google.com/500',
        instagram: 'http://instagram.com/bella',
        contacted: false,
        interestStatus: undefined,
        notes: undefined,
        lastContactAt: undefined,
        createdAt: '2026-06-05T02:00:00.000Z'
      });
    });
  });
});
