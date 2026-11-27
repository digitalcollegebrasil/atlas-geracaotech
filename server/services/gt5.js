// Geração Tech 5.0: validações e vínculo do aluno (formação, modalidade, polo e turma).
// As regras vêm de docs/GT5-DIRETRIZES.md, seções 2 e 3. Funções puras ficam separadas do banco para teste.
const httpError = require('../utils/httpError');
const { text, phone, uf } = require('./validators');
const { setTurmaDoAluno } = require('./turmaSync');

const MODALIDADES = ['Online', 'Presencial'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// IDs são UUID. Um valor fora do formato vira 400, e não erro de banco.
function uuid(value, field) {
  if (typeof value !== 'string' || !UUID.test(value)) throw httpError(400, `${field} inválido.`);
  return value;
}
function uuidOpcional(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return uuid(value, field);
}

function parsePolo(body, { parcial = false } = {}) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Dados do polo inválidos.');
  const out = {};
  if (!parcial || body.nome !== undefined) out.nome = text(body.nome, { field: 'Nome do polo', max: 120 });
  if (body.cidade !== undefined || !parcial) out.cidade = text(body.cidade ?? out.nome, { field: 'Cidade', max: 120, optional: true }) || out.nome;
  if (body.uf !== undefined || !parcial) out.uf = uf(body.uf ?? 'CE');
  if (body.ativa !== undefined) out.ativa = Boolean(body.ativa);
  return out;
}

function parseLideranca(body, { parcial = false } = {}) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Dados da liderança inválidos.');
  const out = {};
  if (!parcial || body.nome !== undefined) out.nome = text(body.nome, { field: 'Nome da liderança', max: 160 });
  if (body.email !== undefined) {
    const email = (text(body.email, { field: 'E-mail', max: 160, optional: true }) || '').toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'E-mail inválido.');
    out.email = email;
  }
  if (body.telefone !== undefined) out.telefone = phone(body.telefone) || '';
  if (body.polo_id !== undefined) out.polo_id = uuidOpcional(body.polo_id, 'Polo');
  if (body.ativa !== undefined) out.ativa = Boolean(body.ativa);
  return out;
}

function parseVinculo(body) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Dados do vínculo inválidos.');
  if (!MODALIDADES.includes(body.modalidade)) throw httpError(400, 'Modalidade inválida. Use Online ou Presencial.');
  return {
    formacaoId: uuid(body.formacao_id, 'Formação'),
    modalidade: body.modalidade,
    poloId: uuidOpcional(body.polo_id, 'Polo'),
    turmaId: uuidOpcional(body.turma_id, 'Turma'),
  };
}

// Regras de distribuição: Online usa só vagas online; Presencial usa vagas de Fortaleza (sem polo)
// ou do interior (com polo). Formação sem vagas no local escolhido não aceita o vínculo.
function validarLocal(formacao, modalidade, poloId) {
  if (modalidade === 'Online') {
    if (poloId) throw httpError(400, 'Aluno online não pode ser vinculado a um polo.');
    if (!formacao.vagas_online) throw httpError(400, 'Esta formação não tem vagas online.');
    return;
  }
  if (poloId) {
    if (!formacao.vagas_interior) throw httpError(400, 'Esta formação não tem vagas no interior.');
    return;
  }
  if (!formacao.vagas_fortaleza) throw httpError(400, 'Esta formação não tem vagas presenciais em Fortaleza. Informe um polo.');
}

// A turma precisa ser da mesma formação, modalidade e polo do aluno.
function validarTurma(turma, { cursoId, modalidade, poloId }) {
  if (!turma) throw httpError(404, 'Turma não encontrada.');
  if (turma.curso_id !== cursoId) throw httpError(400, 'A turma é de outra formação.');
  if (turma.modalidade !== modalidade) throw httpError(400, 'A modalidade da turma não confere com a do aluno.');
  if ((turma.sede_id || null) !== (poloId || null)) throw httpError(400, 'O polo da turma não confere com o do aluno.');
  if (!turma.ativa) throw httpError(400, 'A turma está inativa.');
}

// Vincula um aluno (matrícula já recebida do site) à modalidade, ao polo e à turma.
// A formação não muda aqui: ela já vem da matrícula, e precisa ser a formação informada.
async function vincularAluno(client, matriculaId, vinculo) {
  const { rows: mRows } = await client.query('select id, curso_id from matriculas where id = $1 for update', [matriculaId]);
  const matricula = mRows[0];
  if (!matricula) throw httpError(404, 'Matrícula não encontrada.');
  if (matricula.curso_id !== vinculo.formacaoId) throw httpError(409, 'A matrícula é de outra formação.');

  const { rows: fRows } = await client.query(
    'select course_id, vagas_online, vagas_fortaleza, vagas_interior from formacoes_edicao where course_id = $1',
    [vinculo.formacaoId]
  );
  if (!fRows[0]) throw httpError(400, 'Esta formação não é da edição GT 5.0.');

  let poloId = null;
  if (vinculo.poloId) {
    const { rows: pRows } = await client.query("select id from sedes where id = $1 and tipo = 'polo' and ativa", [vinculo.poloId]);
    if (!pRows[0]) throw httpError(400, 'Polo não encontrado ou inativo.');
    poloId = pRows[0].id;
  }
  validarLocal(fRows[0], vinculo.modalidade, poloId);

  if (vinculo.turmaId) {
    const { rows: tRows } = await client.query('select id, curso_id, modalidade, sede_id, ativa from turmas where id = $1', [vinculo.turmaId]);
    validarTurma(tRows[0], { cursoId: vinculo.formacaoId, modalidade: vinculo.modalidade, poloId });
  }

  await client.query(
    'update matriculas set modalidade = $2, sede_id = $3, data_atualizacao = now() where id = $1',
    [matriculaId, vinculo.modalidade, poloId]
  );
  await setTurmaDoAluno(client, matriculaId, vinculo.turmaId);
  return { matriculaId, modalidade: vinculo.modalidade, poloId, turmaId: vinculo.turmaId };
}

module.exports = { uuid, uuidOpcional, parsePolo, parseLideranca, parseVinculo, validarLocal, validarTurma, vincularAluno };
