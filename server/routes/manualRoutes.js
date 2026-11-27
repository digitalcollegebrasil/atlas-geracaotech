const express = require('express');
const controller = require('../controllers/manualController');
const requireRole = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Leitura: qualquer usuário logado (já checado no mount). Edição: só administração.
router.get('/', asyncHandler(controller.obter));
router.put('/', requireRole('admin'), asyncHandler(controller.salvar));

module.exports = router;
