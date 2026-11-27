// Geração Tech 5.0: formações, vagas, polos, lideranças, turmas e vínculo do aluno. Só administração.
// Inscrições e matrículas vêm do site do GT; aqui a gestão edita a capacidade e organiza o estudo.
const { query, withTransaction, getPool } = require('../db/pool');
const httpError = require('../utils/httpError');
const gt5 = require('../services/gt5');
const { importarTurmas } = require('../services/gt5Turmas');

const { uuid, uuidOpcional, parsePolo, parseLideranca, parseVinculo, parseFormacao, montarVagas, ocupacaoPorLocal, vincularAluno } = gt5;

// Formações da edição 5.0, com carga, duração, vagas e ocupação por local.
exports.listarFormacoes = async (req, res) => {
  const { rows } = await query(
    `select c.id, c.slug, c.title, c.summary, c.visible, c.self_enrolment,
            f.carga_horaria, f.duracao_semanas, f.vagas_total, f.vagas_online, f.vagas_fortaleza, f.vagas_interior
     from formacoes_edicao f join courses c on c.id = f.course_id
     order by c.title`
  );
  const formacoes = [];
  for (const f of rows) {
    const ocupadas = await ocupacaoPorLocal(getPool(), f.id);
    formacoes.push({
      id: f.id, slug: f.slug, title: f.title, summary: f.summary, visible: f.visible, self_enrolment: f.self_enrolment,
      carga_horaria: f.carga_horaria, duracao_semanas: f.duracao_semanas,
      vagas: montarVagas(f, ocupadas),
    });
  }
  res.json({ formacoes });
};

// Edita carga, duração e vagas. Vagas por local precisam somar o total.
exports.atualizarFormacao = async (req, res) => {
  const id = uuid(req.params.id, 'Formação');
  const { rows } = await query('select * from formacoes_edicao where course_id = $1', [id]);
  if (!rows[0]) throw httpError(404, 'Formação não encontrada.');
  const alteracoes = parseFormacao(req.body, rows[0]);
  const campos = Object.keys(alteracoes);
  if (!campos.length) throw httpError(400, 'Nada para atualizar.');
  await query(
    `update formacoes_edicao set ${campos.map((c, i) => `${c} = $${i + 2}`).join(', ')} where course_id = $1`,
    [id, ...campos.map((c) => alteracoes[c])]
  );
  res.json({ atualizado: true, campos });
};

// Polos: locais presenciais do interior (tipo 'polo' em sedes).
exports.listarPolos = async (req, res) => {
  const { rows } = await query("select id, nome, cidade, uf, ativa from sedes where tipo = 'polo' order by nome");
  res.json({ polos: rows });
};

exports.criarPolo = async (req, res) => {
  const data = parsePolo(req.body);
  const { rows } = await query(
    `insert into sedes (nome, cidade, uf, tipo, ativa) values ($1, $2, $3, 'polo', true)
     returning id, nome, cidade, uf, ativa`,
    [data.nome, data.cidade, data.uf]
  ).catch((erro) => {
    if (erro.code === '23505') throw httpError(409, 'Já existe um polo com este nome.');
    throw erro;
  });
  res.status(201).json({ polo: rows[0] });
};

exports.atualizarPolo = async (req, res) => {
  const data = parsePolo(req.body, { parcial: true });
  const campos = Object.keys(data);
  if (!campos.length) throw httpError(400, 'Nada para atualizar.');
  const { rows } = await query(
    `update sedes set ${campos.map((c, i) => `${c} = $${i + 2}`).join(', ')}
     where id = $1 and tipo = 'polo' returning id, nome, cidade, uf, ativa`,
    [uuid(req.params.id, 'Polo'), ...campos.map((c) => data[c])]
  );
  if (!rows[0]) throw httpError(404, 'Polo não encontrado.');
  res.json({ polo: rows[0] });
};

// Lideranças territoriais, com filtro opcional por polo.
exports.listarLiderancas = async (req, res) => {
  const poloId = uuidOpcional(req.query.polo_id, 'Polo');
  const { rows } = await query(
    `select l.id, l.nome, l.email, l.telefone, l.ativa, l.polo_id, s.nome as polo_nome
     from liderancas_territoriais l left join sedes s on s.id = l.polo_id
     where ($1::uuid is null or l.polo_id = $1::uuid)
     order by l.nome`,
    [poloId]
  );
  res.json({ liderancas: rows });
};

async function poloExiste(poloId) {
  if (!poloId) return;
  uuid(poloId, 'Polo');
  const { rows } = await query("select 1 from sedes where id = $1 and tipo = 'polo'", [poloId]);
  if (!rows[0]) throw httpError(400, 'Polo não encontrado.');
}

exports.criarLideranca = async (req, res) => {
  const data = parseLideranca(req.body);
  await poloExiste(data.polo_id);
  const { rows } = await query(
    `insert into liderancas_territoriais (nome, email, telefone, polo_id, ativa)
     values ($1, $2, $3, $4, $5) returning id, nome, email, telefone, polo_id, ativa`,
    [data.nome, data.email || '', data.telefone || '', data.polo_id || null, data.ativa ?? true]
  );
  res.status(201).json({ lideranca: rows[0] });
};

exports.atualizarLideranca = async (req, res) => {
  const data = parseLideranca(req.body, { parcial: true });
  if (data.polo_id !== undefined) await poloExiste(data.polo_id);
  const campos = Object.keys(data);
  if (!campos.length) throw httpError(400, 'Nada para atualizar.');
  const { rows } = await query(
    `update liderancas_territoriais set ${campos.map((c, i) => `${c} = $${i + 2}`).join(', ')}
     where id = $1 returning id, nome, email, telefone, polo_id, ativa`,
    [uuid(req.params.id, 'Liderança'), ...campos.map((c) => data[c])]
  );
  if (!rows[0]) throw httpError(404, 'Liderança não encontrada.');
  res.json({ lideranca: rows[0] });
};

// Importa turmas por planilha (CSV no corpo: { "csv": "..." }). Se houver erro, nada é gravado.
exports.importarTurmas = async (req, res) => {
  try {
    const resultado = await withTransaction((client) => importarTurmas(client, req.body?.csv));
    res.json(resultado);
  } catch (erro) {
    if (erro.detalhes) return res.status(400).json({ message: erro.message, erros: erro.detalhes });
    throw erro;
  }
};

// Vínculo do aluno: modalidade, polo e turma, validados contra a formação e as vagas.
exports.vincularMatricula = async (req, res) => {
  const vinculo = parseVinculo(req.body);
  const resultado = await withTransaction((client) => vincularAluno(client, uuid(req.params.id, 'Matrícula'), vinculo));
  res.json({ vinculo: resultado });
};
