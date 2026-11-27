// Geração Tech 5.0: cadastro de formações, polos, lideranças e vínculo do aluno. Só administração.
const { query, withTransaction } = require('../db/pool');
const httpError = require('../utils/httpError');
const { uuid, uuidOpcional, parsePolo, parseLideranca, parseVinculo, vincularAluno } = require('../services/gt5');

// Formações da edição 5.0, com carga, duração e vagas por modalidade e local.
exports.listarFormacoes = async (req, res) => {
  const { rows } = await query(
    `select c.id, c.slug, c.title, c.summary, c.visible, c.self_enrolment,
            f.carga_horaria, f.duracao_semanas, f.vagas_total, f.vagas_online, f.vagas_fortaleza, f.vagas_interior
     from formacoes_edicao f join courses c on c.id = f.course_id
     order by c.title`
  );
  res.json({ formacoes: rows });
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

// Vínculo do aluno: modalidade, polo e turma, validados contra a formação e as vagas.
exports.vincularMatricula = async (req, res) => {
  const vinculo = parseVinculo(req.body);
  const resultado = await withTransaction((client) => vincularAluno(client, uuid(req.params.id, 'Matrícula'), vinculo));
  res.json({ vinculo: resultado });
};
