const express = require('express');
const gt5 = require('../controllers/gt5Controller');
const requireRole = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Geração Tech 5.0: cadastro acadêmico e gestão. Só administração.
router.use(requireRole('admin'));

router.get('/formacoes', asyncHandler(gt5.listarFormacoes));
router.patch('/formacoes/:id', asyncHandler(gt5.atualizarFormacao));

router.get('/configuracao', asyncHandler(gt5.obterConfiguracao));
router.patch('/configuracao', asyncHandler(gt5.atualizarConfiguracao));

router.get('/polos', asyncHandler(gt5.listarPolos));
router.post('/polos', asyncHandler(gt5.criarPolo));
router.patch('/polos/:id', asyncHandler(gt5.atualizarPolo));
router.delete('/polos/:id', asyncHandler(gt5.excluirPolo));

router.get('/liderancas', asyncHandler(gt5.listarLiderancas));
router.post('/liderancas', asyncHandler(gt5.criarLideranca));
router.patch('/liderancas/:id', asyncHandler(gt5.atualizarLideranca));
router.delete('/liderancas/:id', asyncHandler(gt5.excluirLideranca));

router.get('/turmas', asyncHandler(gt5.listarTurmas));
router.post('/turmas', asyncHandler(gt5.criarTurma));
router.get('/turmas/exportar', asyncHandler(gt5.exportarTurmas));
router.post('/turmas/importar', asyncHandler(gt5.importarTurmas));
router.patch('/turmas/:id', asyncHandler(gt5.atualizarTurma));
router.delete('/turmas/:id', asyncHandler(gt5.excluirTurma));

router.put('/matriculas/:id/vinculo', asyncHandler(gt5.vincularMatricula));

module.exports = router;
