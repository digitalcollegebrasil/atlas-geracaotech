const express = require('express');
const gt5 = require('../controllers/gt5Controller');
const requireRole = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Geração Tech 5.0: cadastro acadêmico. Só administração.
router.use(requireRole('admin'));

router.get('/formacoes', asyncHandler(gt5.listarFormacoes));

router.get('/polos', asyncHandler(gt5.listarPolos));
router.post('/polos', asyncHandler(gt5.criarPolo));
router.patch('/polos/:id', asyncHandler(gt5.atualizarPolo));

router.get('/liderancas', asyncHandler(gt5.listarLiderancas));
router.post('/liderancas', asyncHandler(gt5.criarLideranca));
router.patch('/liderancas/:id', asyncHandler(gt5.atualizarLideranca));

router.put('/matriculas/:id/vinculo', asyncHandler(gt5.vincularMatricula));

module.exports = router;
