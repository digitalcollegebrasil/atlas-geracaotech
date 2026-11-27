const authRepo = require('../db/authRepo');

// Acessos (log de logins), visíveis somente à gestão.
// As declarações agora são geradas pelo próprio aluno (ver meController.matriculaPdf).
async function listLogins(req, res) {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const DATA = /^\d{4}-\d{2}-\d{2}$/;
  const resultado = ['sucesso', 'falha'].includes(req.query.resultado) ? req.query.resultado : null;
  const de = DATA.test(req.query.de || '') ? req.query.de : null;
  const ate = DATA.test(req.query.ate || '') ? req.query.ate : null;
  const busca = String(req.query.busca || '').trim().slice(0, 100) || null;
  res.json({ events: await authRepo.listLoginEvents({ limit, resultado, de, ate, busca }) });
}

module.exports = { listLogins };