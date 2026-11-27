const atendimento = require('../db/atendimentoRepo');

// Monitoria: salas do Codice que a equipe técnica acompanha (mesmos endereços que o aluno vê na aula).
exports.salasCodice = async (req, res) => res.json({ salas: await atendimento.listarSalasCodice() });
