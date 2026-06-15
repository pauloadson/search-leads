const dbService = require('../services/db.service');

exports.getTemplates = async (req, res) => {
  try {
    const templates = await dbService.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Erro ao buscar templates' });
  }
};

exports.saveTemplate = async (req, res) => {
  try {
    const { id, name, content, isDefault } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });
    }
    const template = await dbService.saveTemplate({ id, name, content, isDefault });
    res.json(template);
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Erro ao salvar template' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await dbService.deleteTemplate(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Erro ao deletar template' });
  }
};
