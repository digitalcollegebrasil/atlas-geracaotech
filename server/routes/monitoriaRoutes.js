const express = require('express');
const monitoria = require('../controllers/monitoriaController');
const requireRole = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Codice: a monitoria e a administração veem as salas, como o aluno vê na aula.
router.get('/codice', requireRole('admin', 'monitor'), asyncHandler(monitoria.salasCodice));

module.exports = router;
