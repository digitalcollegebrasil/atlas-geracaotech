// Geração Tech 5.0: validações, controle de vagas e vínculo do aluno (formação, modalidade, polo e turma).
// As regras vêm de docs/GT5-DIRETRIZES.md, seções 2 e 3. Inscrição e matrícula vêm do site do GT.
// Funções puras ficam separadas do banco para teste.
const httpError = require('../utils/httpError');
const { text, phone, uf } = require('./validators');
const { setTurmaDoAluno } = require('./turmaSync');

const MODALIDADES = ['Online', 'Presencial'];
const LOCAIS = ['online', 'fortaleza', 'interior'];
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

function inteiro(value, { field, min }) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n < min) throw httpError(400, `${field} deve ser um número inteiro maior ou igual a ${min}.`);
  return n;
}

// Edição da formação: carga e duração podem ficar vazias; as vagas são sempre números inteiros.
function parseFormacao(body, atual) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Dados da formação inválidos.');
  const out = {};
  if (body.carga_horaria !== undefined) {
    out.carga_horaria = body.carga_horaria === null || body.carga_horaria === '' ? null : inteiro(body.carga_horaria, { field: 'Carga horária', min: 1 });
  }
  if (body.duracao_semanas !== undefined) {
    out.duracao_semanas = body.duracao_semanas === null || body.duracao_semanas === '' ? null : inteiro(body.duracao_semanas, { field: 'Duração em semanas', min: 1 });
  }
  for (const campo of ['vagas_total', 'vagas_online', 'vagas_fortaleza', 'vagas_interior']) {
    if (body[campo] !== undefined) out[campo] = inteiro(body[campo], { field: campo.replace('_', ' '), min: campo === 'vagas_total' ? 1 : 0 });
  }
  const final = { ...atual, ...out };
  validarVagas(final);
  return out;
}

// Vagas por local têm que somar o total da formação.
function validarVagas(v) {
  if (v.vagas_online + v.vagas_fortaleza + v.vagas_interior !== v.vagas_total) {
    throw httpError(400, 'A soma das vagas online, em Fortaleza e no interior precisa ser igual ao total.');
  }
}

// Ocupação por local, a partir das matrículas sincronizadas do site (situação ativa).
// Matrículas sem polo e presenciais são Fortaleza; com polo, interior.
function montarVagas(formacao, ocupadas) {
  const linha = (local, total) => {
    const ocupados = ocupadas[local] || 0;
    return { total, ocupadas: ocupados, disponiveis: total - ocupados };
  };
  return {
    total: formacao.vagas_total,
    online: linha('online', formacao.vagas_online),
    fortaleza: linha('fortaleza', formacao.vagas_fortaleza),
    interior: linha('interior', formacao.vagas_interior),
  };
}

// Local de uma matrícula, conforme modalidade e polo.
function localDe(modalidade, poloId) {
  if (modalidade === 'Online') return 'online';
  return poloId ? 'interior' : 'fortaleza';
}

// Matrículas ativas por local de uma formação. excluirMatriculaId tira o próprio aluno da conta.
async function ocupacaoPorLocal(client, cursoId, excluirMatriculaId = null) {
  const { rows } = await client.query(
    `select
       count(*) filter (where modalidade = 'Online') as online,
       count(*) filter (where modalidade = 'Presencial' and sede_id is null) as fortaleza,
       count(*) filter (where modalidade = 'Presencial' and sede_id is not null) as interior
     from matriculas
     where curso_id = $1 and situacao = 'ativo' and ($2::uuid is null or id <> $2::uuid)`,
    [cursoId, excluirMatriculaId]
  );
  return { online: Number(rows[0].online), fortaleza: Number(rows[0].fortaleza), interior: Number(rows[0].interior) };
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
// Se o aluno muda de local, o local de destino precisa ter vaga disponível.
async function vincularAluno(client, matriculaId, vinculo) {
  const { rows: mRows } = await client.query('select id, curso_id, modalidade, sede_id from matriculas where id = $1 for update', [matriculaId]);
  const matricula = mRows[0];
  if (!matricula) throw httpError(404, 'Matrícula não encontrada.');
  if (matricula.curso_id !== vinculo.formacaoId) throw httpError(409, 'A matrícula é de outra formação.');

  const { rows: fRows } = await client.query(
    'select course_id, vagas_total, vagas_online, vagas_fortaleza, vagas_interior from formacoes_edicao where course_id = $1',
    [vinculo.formacaoId]
  );
  const formacao = fRows[0];
  if (!formacao) throw httpError(400, 'Esta formação não é da edição GT 5.0.');

  let poloId = null;
  if (vinculo.poloId) {
    const { rows: pRows } = await client.query("select id from sedes where id = $1 and tipo = 'polo' and ativa", [vinculo.poloId]);
    if (!pRows[0]) throw httpError(400, 'Polo não encontrado ou inativo.');
    poloId = pRows[0].id;
  }
  validarLocal(formacao, vinculo.modalidade, poloId);

  const destino = localDe(vinculo.modalidade, poloId);
  const atual = localDe(matricula.modalidade, matricula.sede_id);
  if (destino !== atual) {
    const ocupadas = await ocupacaoPorLocal(client, vinculo.formacaoId, matriculaId);
    const total = { online: formacao.vagas_online, fortaleza: formacao.vagas_fortaleza, interior: formacao.vagas_interior }[destino];
    if (ocupadas[destino] >= total) throw httpError(409, 'Não há vagas disponíveis neste local.');
  }

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

module.exports = {
  LOCAIS, uuid, uuidOpcional, parseFormacao, validarVagas, montarVagas, localDe, ocupacaoPorLocal,
  parsePolo, parseLideranca, parseVinculo, validarLocal, validarTurma, vincularAluno,
};
