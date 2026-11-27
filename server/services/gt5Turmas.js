// Importação de turmas do GT 5.0 por planilha (CSV). Usa a mesma rotina das turmas que o site envia,
// então a planilha e a integração com o site não criam duplicatas (a chave é o código da turma).
// Tudo ou nada: se alguma linha tiver erro, nenhuma turma é gravada.
const httpError = require('../utils/httpError');
const { upsertTurma, parseTurma } = require('./turmaSync');
const { validarLocal } = require('./gt5');

// Colunas da planilha, nesta ordem. Só "codigo", "curso" e "modalidade" são obrigatórias.
const COLUNAS = ['codigo', 'curso', 'modalidade', 'sede', 'nome', 'turno', 'dias_semana', 'horario', 'data_inicio', 'data_fim', 'ativa'];
const OBRIGATORIAS = ['codigo', 'curso', 'modalidade'];
const MAX_LINHAS = 500;

// Lê o CSV com aspas, vírgula ou ponto e vírgula como separador. Não aceita colunas fora da lista.
function lerCsv(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw httpError(400, 'A planilha está vazia.');
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const separador = linhas[0].includes(';') && !linhas[0].includes(',') ? ';' : ',';

  const campos = (linha) => {
    const out = [];
    let atual = '';
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (aspas) {
        if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
        else if (c === '"') aspas = false;
        else atual += c;
      } else if (c === '"') aspas = true;
      else if (c === separador) { out.push(atual.trim()); atual = ''; }
      else atual += c;
    }
    out.push(atual.trim());
    return out;
  };

  const cabecalho = campos(linhas[0]).map((c) => c.toLowerCase());
  const desconhecidas = cabecalho.filter((c) => !COLUNAS.includes(c));
  if (desconhecidas.length) throw httpError(400, `Colunas não reconhecidas: ${desconhecidas.join(', ')}.`);
  const faltando = OBRIGATORIAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length) throw httpError(400, `Colunas obrigatórias ausentes: ${faltando.join(', ')}.`);
  if (linhas.length - 1 > MAX_LINHAS) throw httpError(400, `A planilha pode ter no máximo ${MAX_LINHAS} turmas por envio.`);

  return linhas.slice(1).map((linha, i) => {
    const valores = campos(linha);
    // Número de campos diferente do cabeçalho indica coluna deslocada; recusa para não gravar no campo errado.
    if (valores.length !== cabecalho.length) {
      throw httpError(400, `Linha ${i + 2} tem ${valores.length} campos, e o cabeçalho tem ${cabecalho.length}. Confira as vírgulas.`);
    }
    const registro = { _linha: i + 2 };
    cabecalho.forEach((coluna, j) => { registro[coluna] = valores[j] ?? ''; });
    return registro;
  });
}

const SIM = ['sim', 's', 'true', '1', 'verdadeiro'];
const NAO = ['não', 'nao', 'n', 'false', '0', 'falso'];

// Converte a linha da planilha no formato que upsertTurma já entende.
function linhaParaTurma(registroBruto) {
  // Coluna que não veio na planilha conta como vazia.
  const campo = (k) => (registroBruto[k] ?? '').toString().trim();
  const ativaTexto = campo('ativa').toLowerCase();
  const ativa = ativaTexto === '' ? undefined : SIM.includes(ativaTexto) ? true : NAO.includes(ativaTexto) ? false : null;
  const vazioParaUndefined = (v) => (v === '' ? undefined : v);
  return {
    codigo: campo('codigo'),
    curso: campo('curso'),
    modalidade: vazioParaUndefined(campo('modalidade')),
    sede: vazioParaUndefined(campo('sede')),
    nome: vazioParaUndefined(campo('nome')),
    turno: campo('turno'),
    dias_semana: campo('dias_semana'),
    horario: campo('horario'),
    data_inicio: vazioParaUndefined(campo('data_inicio')),
    data_fim: vazioParaUndefined(campo('data_fim')),
    ativa,
  };
}

// Confere cada linha contra a formação e as vagas. Devolve a lista de erros (vazia se tudo estiver certo).
async function conferirLinhas(client, registros) {
  const erros = [];
  const formacoes = new Map();
  for (const registro of registros) {
    const linha = registro._linha;
    const body = linhaParaTurma(registro);
    if (body.ativa === null) { erros.push({ linha, erro: 'Coluna "ativa" deve ser sim ou não.' }); continue; }
    if (!['Online', 'Presencial'].includes(body.modalidade)) { erros.push({ linha, erro: 'Modalidade deve ser Online ou Presencial.' }); continue; }
    if (!body.codigo) { erros.push({ linha, erro: 'Código da turma é obrigatório.' }); continue; }
    try {
      parseTurma(body);
    } catch (e) {
      erros.push({ linha, erro: e.message });
      continue;
    }
    const existente = await client.query('select 1 from turmas where external_id = $1', [body.codigo]);
    if (!existente.rows[0] && !body.nome) { erros.push({ linha, erro: 'Nome da turma é obrigatório para uma turma nova.' }); continue; }

    if (!formacoes.has(body.curso)) {
      const { rows } = await client.query(
        `select c.id, f.vagas_online, f.vagas_fortaleza, f.vagas_interior
         from courses c join formacoes_edicao f on f.course_id = c.id where c.slug = $1`,
        [body.curso]
      );
      formacoes.set(body.curso, rows[0] || null);
    }
    const formacao = formacoes.get(body.curso);
    if (!formacao) { erros.push({ linha, erro: `Formação GT 5.0 não encontrada: ${body.curso}.` }); continue; }

    let poloId = null;
    if (body.sede) {
      const { rows } = await client.query("select id from sedes where lower(nome) = lower($1) and tipo = 'polo' and ativa", [body.sede]);
      if (!rows[0]) { erros.push({ linha, erro: `Polo não cadastrado ou inativo: ${body.sede}.` }); continue; }
      poloId = rows[0].id;
    }
    try {
      validarLocal(formacao, body.modalidade, poloId);
    } catch (e) {
      erros.push({ linha, erro: e.message });
    }
  }
  return erros;
}

// Confere e grava as turmas numa transação. Se houver erro, nada é gravado.
// Usada pela planilha e pela integração JSON, para as duas seguirem a mesma regra.
async function aplicarRegistros(client, registros) {
  if (!registros.length) throw httpError(400, 'A planilha não tem turmas.');
  const erros = await conferirLinhas(client, registros);
  if (erros.length) {
    const error = httpError(400, 'Há erros nas turmas. Nenhuma turma foi gravada.');
    error.detalhes = erros;
    throw error;
  }

  let criadas = 0;
  let atualizadas = 0;
  for (const registro of registros) {
    const body = linhaParaTurma(registro);
    const existe = await client.query('select 1 from turmas where external_id = $1', [body.codigo]);
    await upsertTurma(client, body);
    if (existe.rows[0]) atualizadas += 1; else criadas += 1;
  }
  return { criadas, atualizadas, total: registros.length };
}

// Importa a planilha inteira (texto CSV).
async function importarTurmas(client, texto) {
  return aplicarRegistros(client, lerCsv(texto));
}

// Mesma regra da planilha, em JSON: uma lista de objetos com as colunas acima.
// Coluna que não existe é recusada; valor nulo conta como vazio; ativa aceita true/false ou sim/não.
function registrosDeLista(lista) {
  if (!Array.isArray(lista)) throw httpError(400, 'Envie a lista de turmas em "turmas".');
  if (lista.length > MAX_LINHAS) throw httpError(400, `No máximo ${MAX_LINHAS} turmas por envio.`);
  return lista.map((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw httpError(400, `Item ${i + 1} da lista não é um objeto.`);
    const desconhecidas = Object.keys(item).filter((c) => !COLUNAS.includes(c));
    if (desconhecidas.length) throw httpError(400, `Item ${i + 1}: campos não reconhecidos: ${desconhecidas.join(', ')}.`);
    const registro = { _linha: i + 1 };
    COLUNAS.forEach((coluna) => {
      const valor = item[coluna];
      registro[coluna] = valor === undefined || valor === null ? '' : String(valor);
    });
    return registro;
  });
}

// Uma célula do CSV, com aspas quando tem separador ou aspas. Quebra de linha vira espaço,
// porque a leitura da planilha é por linha.
function celulaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor).replace(/\r?\n/g, ' ');
  return /[",;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Exporta as turmas das formações GT 5.0 no mesmo formato que a importação aceita.
// Assim a planilha exportada serve de modelo para a próxima importação.
async function exportarCsv(client) {
  const { rows } = await client.query(
    `select t.external_id as codigo, c.slug as curso, t.modalidade, s.nome as sede, t.nome, t.turno,
            t.dias_semana, t.horario,
            to_char(t.data_inicio, 'YYYY-MM-DD') as data_inicio,
            to_char(t.data_fim, 'YYYY-MM-DD') as data_fim,
            t.ativa
     from turmas t
     join formacoes_edicao f on f.course_id = t.curso_id
     join courses c on c.id = t.curso_id
     left join sedes s on s.id = t.sede_id
     order by c.slug, s.nome nulls first, t.nome`
  );
  const linhas = rows.map((r) => [
    r.codigo ?? '', r.curso, r.modalidade, r.sede ?? '', r.nome, r.turno, r.dias_semana, r.horario,
    r.data_inicio ?? '', r.data_fim ?? '', r.ativa ? 'sim' : 'não',
  ].map(celulaCsv).join(','));
  // BOM no início para o Excel abrir com acentos certos. A importação já aceita o BOM.
  return '﻿' + [COLUNAS.join(','), ...linhas].join('\r\n') + '\r\n';
}

module.exports = { COLUNAS, lerCsv, linhaParaTurma, importarTurmas, aplicarRegistros, registrosDeLista, exportarCsv, celulaCsv };
