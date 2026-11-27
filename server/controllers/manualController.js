const manual = require('../services/manual');

exports.obter = async (req, res) => res.json(await manual.buscarManual());

exports.salvar = async (req, res) => res.json(await manual.salvarManual(req.body, req.user.id));
