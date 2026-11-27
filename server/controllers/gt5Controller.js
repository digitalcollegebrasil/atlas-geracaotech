// Geração Tech 5.0: formações, vagas, polos, lideranças, turmas e vínculo do aluno. Só administração.
// Inscrições e matrículas vêm do site do GT; aqui a gestão edita a capacidade e organiza o estudo.
const { query, withTransaction, getPool } = require('../db/pool');
const httpError = require('../utils/httpError');
const gt5 = require('../services/gt5');
const turmasGt5 = require('../services/gt5Turmas');

const { uuid, uuidOpcional, parsePolo, parseLideranca, parseVinculo, parseFormacao, montarVagas, ocupacaoPorLocal, vincularAluno } = gt5;
const { importarTurmas, aplicarRegistros, registrosDeLista, exportarCsv } = turmasGt5;

// Responde a gravação de turmas. Erros de linha (com a lista de linhas) viram 400 com o relatório.
async function responderGravacao(res, operacao) {
  try {
    res.json(await operacao());
  } catch (erro) {
    if (erro.detalhes) return res.status(400).json({ message: erro.message, erros: erro.detalhes });
    throw erro;
  }
}

// Formações da edição 5.0, com carga, duração, vagas e ocupação por local.
exports.listarFormacoes = async (req, res) => {
  const { rows } = await query(
    `select c.id, c.slug, c.title, c.summary, c.visible, c.self_enrolment,
            f.carga_horaria, f.duracao_semanas, f.vagas_total, f.vagas_online, f.vagas_fortaleza, f.vagas_interior
     from formacoes_edicao f join courses c on c.id = f.course_id
     order by c.title`
  );
  const situacoes = await gt5.situacoesQueOcupam(getPool());
  const provisoria = await gt5.fortalezaProvisoria(getPool());
  const formacoes = [];
  for (const f of rows) {
    const ocupadas = await ocupacaoPorLocal(getPool(), f.id, null, situacoes);
    formacoes.push({
      id: f.id, slug: f.slug, title: f.title, summary: f.summary, visible: f.visible, self_enrolment: f.self_enrolment,
      carga_horaria: f.carga_horaria, duracao_semanas: f.duracao_semanas,
      vagas: montarVagas(f, ocupadas),
    });
  }
  res.json({ formacoes, fortaleza_provisoria: provisoria, concluidas_ocupam_vaga: situacoes.includes('concluido') });
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

// Regra de matrícula concluída. Começa desligada: a gestão ainda não confirmou (pendência no PR).
exports.obterConfiguracao = async (req, res) => {
  const situacoes = await gt5.situacoesQueOcupam(getPool());
  res.json({ matriculas_concluidas_ocupam_vaga: situacoes.includes('concluido') });
};

exports.atualizarConfiguracao = async (req, res) => {
  if (!req.body || typeof req.body.matriculas_concluidas_ocupam_vaga !== 'boolean') {
    throw httpError(400, 'Informe true ou false em matriculas_concluidas_ocupam_vaga.');
  }
  await query(
    `update gt5_configuracao set valor = $1, atualizado_em = now() where chave = 'matriculas_concluidas_ocupam_vaga'`,
    [req.body.matriculas_concluidas_ocupam_vaga]
  );
  res.json({ matriculas_concluidas_ocupam_vaga: req.body.matriculas_concluidas_ocupam_vaga });
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

// Excluir polo só quando nada usa o polo. Se usa, a gestão desativa.
exports.excluirPolo = async (req, res) => {
  const id = uuid(req.params.id, 'Polo');
  const resultado = await withTransaction(async (client) => {
    const { rows: existe } = await client.query("select 1 from sedes where id = $1 and tipo = 'polo' for update", [id]);
    if (!existe[0]) throw httpError(404, 'Polo não encontrado.');
    if (await gt5.vinculosDoPolo(client, id)) {
      throw httpError(409, 'O polo está em uso por matrículas, turmas, lideranças ou vagas. Desative o polo em vez de excluir.');
    }
    await client.query("delete from sedes where id = $1 and tipo = 'polo'", [id]);
    return { excluido: true };
  });
  res.json(resultado);
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

exports.excluirLideranca = async (req, res) => {
  const { rows } = await query('delete from liderancas_territoriais where id = $1 returning id', [uuid(req.params.id, 'Liderança')]);
  if (!rows[0]) throw httpError(404, 'Liderança não encontrada.');
  res.json({ excluida: true });
};

// Turmas das formações GT 5.0, com o número de alunos ativos. Traz também a data da última sincronização.
const SQL_TURMAS = `
  select t.id, t.external_id as codigo, c.slug as curso, c.title as formacao, t.modalidade,
         s.id as polo_id, s.nome as polo, t.nome, t.turno, t.dias_semana, t.horario,
         to_char(t.data_inicio, 'YYYY-MM-DD') as data_inicio,
         to_char(t.data_fim, 'YYYY-MM-DD') as data_fim,
         t.ativa,
         (select count(*) from turma_alunos ta where ta.turma_id = t.id and ta.situacao = 'ativo')::int as alunos
  from turmas t
  join formacoes_edicao f on f.course_id = t.curso_id
  join courses c on c.id = t.curso_id
  left join sedes s on s.id = t.sede_id`;

async function buscarTurma(client, id) {
  const { rows } = await client.query(`${SQL_TURMAS} where t.id = $1`, [id]);
  return rows[0] || null;
}

async function registrarSincronizacao(client, fonte, turmas) {
  await client.query(
    `insert into gt5_sincronizacoes (fonte, sincronizado_em, turmas) values ($1, now(), $2)
     on conflict (fonte) do update set sincronizado_em = now(), turmas = excluded.turmas`,
    [fonte, turmas]
  );
}

exports.listarTurmas = async (req, res) => {
  const { rows } = await query(`${SQL_TURMAS} order by c.title, s.nome nulls first, t.nome`);
  const { rows: sincs } = await query('select fonte, sincronizado_em, turmas from gt5_sincronizacoes');
  const sincronizacoes = Object.fromEntries(sincs.map((s) => [s.fonte, { sincronizado_em: s.sincronizado_em, turmas: s.turmas }]));
  res.json({ turmas: rows, sincronizacoes });
};

// Cria uma turma pela tela. O código é a chave; se já existe, a turma é de outra origem e não sobrescreve.
exports.criarTurma = async (req, res) => {
  const registro = registrosDeLista([req.body])[0];
  await responderGravacao(res, () => withTransaction(async (client) => {
    const { rows: existe } = await client.query('select 1 from turmas where external_id = $1', [registro.codigo]);
    if (existe[0]) throw httpError(409, 'Já existe uma turma com este código.');
    await aplicarRegistros(client, [registro]);
    const { rows } = await client.query('select id from turmas where external_id = $1', [registro.codigo]);
    return { turma: await buscarTurma(client, rows[0].id) };
  }));
};

// Edita nome, turno, dias, horário, datas e situação. Curso, modalidade e polo mudam só pela planilha ou integração.
exports.atualizarTurma = async (req, res) => {
  const id = uuid(req.params.id, 'Turma');
  const alteracoes = gt5.parseEdicaoTurma(req.body);
  if (!Object.keys(alteracoes).length) throw httpError(400, 'Nada para atualizar.');
  const turma = await withTransaction(async (client) => {
    const atual = await buscarTurma(client, id);
    if (!atual) throw httpError(404, 'Turma não encontrada.');
    const final = { ...atual, ...alteracoes };
    gt5.validarPeriodo(final.data_inicio, final.data_fim);
    const campos = Object.keys(alteracoes);
    await client.query(
      `update turmas set ${campos.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1`,
      [id, ...campos.map((c) => alteracoes[c])]
    );
    return buscarTurma(client, id);
  });
  res.json({ turma });
};

// Excluir turma só sem alunos, equipe, professores, mural ou presença. Caso contrário, desativar.
exports.excluirTurma = async (req, res) => {
  const id = uuid(req.params.id, 'Turma');
  await withTransaction(async (client) => {
    const { rows } = await client.query('select 1 from turmas where id = $1 for update', [id]);
    if (!rows[0]) throw httpError(404, 'Turma não encontrada.');
    if (await gt5.vinculosDaTurma(client, id)) {
      throw httpError(409, 'A turma tem alunos, equipe, professores, mural ou presença registrados. Desative a turma em vez de excluir.');
    }
    await client.query('delete from turmas where id = $1', [id]);
  });
  res.json({ excluida: true });
};

// Exporta as turmas GT 5.0 em CSV, no mesmo formato que a importação aceita.
exports.exportarTurmas = async (req, res) => {
  const csv = await exportarCsv(getPool());
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="turmas-gt5.csv"');
  res.send(csv);
};

// Importa a planilha (CSV no corpo: { "csv": "..." }). Se houver erro, nada é gravado.
exports.importarTurmas = async (req, res) => {
  await responderGravacao(res, () => withTransaction(async (client) => {
    const resultado = await importarTurmas(client, req.body?.csv);
    await registrarSincronizacao(client, 'planilha', resultado.total);
    return resultado;
  }));
};

// Integração com o site do GT (JSON, com X-Atlas-Key): mesma regra da planilha, em lote, tudo ou nada.
exports.receberTurmasIntegracao = async (req, res) => {
  await responderGravacao(res, () => withTransaction(async (client) => {
    const resultado = await aplicarRegistros(client, registrosDeLista(req.body?.turmas));
    await registrarSincronizacao(client, 'integracao', resultado.total);
    return resultado;
  }));
};

// Vínculo do aluno: modalidade, polo e turma, validados contra a formação e as vagas.
exports.vincularMatricula = async (req, res) => {
  const vinculo = parseVinculo(req.body);
  const resultado = await withTransaction((client) => vincularAluno(client, uuid(req.params.id, 'Matrícula'), vinculo));
  res.json({ vinculo: resultado });
};
