const httpError = require('../utils/httpError');
const { lerCsvComColunas } = require('../utils/csvSimples');

// Importação de ponto de professores pela gestão. Regras puras (sem banco) ficam aqui e são testadas.
// Uma linha vira um registro por dia do intervalo (data_inicio até data_fim), opcionalmente só nos dias da semana informados.

const COLUNAS = ['professor', 'turma', 'data_inicio', 'data_fim', 'dias_semana', 'entrada', 'saida', 'tipo', 'titulo', 'observacao'];
const DIAS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const MAX_DIAS_POR_LINHA = 366;
const MAX_REGISTROS = 2000;

function semAcento(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Aceita AAAA-MM-DD e DD/MM/AAAA. Devolve o ISO ou null.
function dataDe(texto) {
  const t = String(texto || '').trim();
  let iso = null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

// Aceita H:MM e HH:MM. Devolve HH:MM ou null.
function horaDe(texto) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(texto || '').trim());
  if (!m || Number(m[1]) > 23) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// Tipo: vazio ou "aula"/"regular" = aula; "extra" = aula extra. Outro valor = null (erro).
function tipoDe(texto) {
  const t = semAcento(texto);
  if (!t || t === 'aula' || t === 'regular') return 'aula';
  if (t === 'extra') return 'extra';
  return null;
}

// Dias da semana: "seg, qua" ou "seg;qua" ou "seg/qua". Vazio = todos os dias. Inválido = null.
function diasDe(texto) {
  const partes = semAcento(texto).split(/[,;|/\s]+/).filter(Boolean);
  if (!partes.length) return new Set();
  const dias = new Set();
  for (const p of partes) {
    const chave = p.slice(0, 3);
    if (!(chave in DIAS)) return null;
    dias.add(DIAS[chave]);
  }
  return dias;
}

// Datas de um intervalo (inclusive) filtradas por dia da semana.
function datasDoIntervalo(inicio, fim, dias) {
  const datas = [];
  const cursor = new Date(`${inicio}T00:00:00Z`);
  const limite = new Date(`${fim}T00:00:00Z`);
  while (cursor <= limite) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dias.size || dias.has(cursor.getUTCDay())) datas.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return datas;
}

// Lê a planilha e expande as linhas em registros diários. Não consulta o banco: nomes são resolvidos depois.
function registrosDaPlanilha(texto) {
  const linhas = lerCsvComColunas(texto, COLUNAS);
  const erros = [];
  const registros = [];

  for (const l of linhas) {
    const n = l._linha;
    const falhas = [];
    if (!l.professor) falhas.push('professor é obrigatório');
    const inicio = dataDe(l.data_inicio);
    if (!inicio) falhas.push('data_inicio inválida (use AAAA-MM-DD ou DD/MM/AAAA)');
    const fim = l.data_fim ? dataDe(l.data_fim) : inicio;
    if (l.data_fim && !fim) falhas.push('data_fim inválida');
    if (inicio && fim && fim < inicio) falhas.push('data_fim é anterior à data_inicio');
    if (inicio && fim && datasDoIntervalo(inicio, fim, new Set()).length > MAX_DIAS_POR_LINHA) {
      falhas.push(`o intervalo passa de ${MAX_DIAS_POR_LINHA} dias`);
    }
    const entrada = horaDe(l.entrada);
    if (!entrada) falhas.push('entrada inválida (use HH:MM)');
    const saida = horaDe(l.saida);
    if (!saida) falhas.push('saída inválida (use HH:MM)');
    if (entrada && saida && saida <= entrada) falhas.push('a saída precisa ser depois da entrada');
    const tipo = tipoDe(l.tipo);
    if (!tipo) falhas.push('tipo deve ser "aula" ou "extra"');
    if (tipo === 'extra' && !l.titulo) falhas.push('aula extra precisa de título');
    const dias = diasDe(l.dias_semana);
    if (dias === null) falhas.push('dias_semana inválido (use seg, ter, qua, qui, sex, sab, dom)');
    if (l.titulo.length > 120) falhas.push('título com mais de 120 caracteres');
    if (l.observacao.length > 300) falhas.push('observação com mais de 300 caracteres');

    if (falhas.length) {
      erros.push(`Linha ${n}: ${falhas.join('; ')}.`);
      continue;
    }
    for (const data of datasDoIntervalo(inicio, fim, dias)) {
      registros.push({ linha: n, professor: l.professor, turma: l.turma, data, entrada, saida, tipo, titulo: l.titulo, observacao: l.observacao });
    }
  }

  if (!erros.length && registros.length > MAX_REGISTROS) {
    erros.push(`A planilha gera ${registros.length} registros. O limite por importação é ${MAX_REGISTROS}; divida em partes.`);
  }
  return { registros, erros };
}

// Resolve professor e turma (por nome ou e-mail, sem diferenciar maiúsculas). Ausente ou ambíguo vira erro com a linha.
async function resolverReferencias(registros, repo) {
  const erros = [];
  const professores = new Map();
  const turmas = new Map();
  for (const r of registros) {
    const chaveP = semAcento(r.professor);
    if (!professores.has(chaveP)) {
      const achados = await repo.buscarProfessorPorNomeOuEmail(r.professor);
      professores.set(chaveP, achados.length === 1 ? achados[0].id : (achados.length ? 'ambiguo' : null));
    }
    const idP = professores.get(chaveP);
    if (!idP || idP === 'ambiguo') {
      erros.push(`Linha ${r.linha}: ${idP ? 'mais de um professor' : 'professor não encontrado'} com o nome "${r.professor}" (use o e-mail).`);
      r.userId = null;
    } else {
      r.userId = idP;
    }

    r.turmaId = null;
    if (r.turma) {
      const chaveT = semAcento(r.turma);
      if (!turmas.has(chaveT)) {
        const achados = await repo.buscarTurmaPorNome(r.turma);
        turmas.set(chaveT, achados.length === 1 ? achados[0].id : (achados.length ? 'ambiguo' : null));
      }
      const idT = turmas.get(chaveT);
      if (!idT || idT === 'ambiguo') {
        erros.push(`Linha ${r.linha}: ${idT ? 'mais de uma turma' : 'turma não encontrada'} com o nome "${r.turma}".`);
      } else {
        r.turmaId = idT;
      }
    }
  }
  return erros;
}

// Importação completa: tudo ou nada. Erros voltam com a lista de linhas para correção.
async function importarPlanilhaPonto(texto, repo) {
  const { registros, erros } = registrosDaPlanilha(texto);
  if (erros.length) {
    throw Object.assign(httpError(400, 'A planilha tem erros. Nada foi importado.'), { detalhes: erros });
  }
  const errosRef = await resolverReferencias(registros, repo);
  if (errosRef.length) {
    throw Object.assign(httpError(400, 'Alguns professores ou turmas não foram encontrados. Nada foi importado.'), { detalhes: errosRef });
  }
  const gravados = await repo.criarPontosGestao(registros);
  return { importados: gravados };
}

module.exports = { COLUNAS, dataDe, horaDe, tipoDe, diasDe, datasDoIntervalo, registrosDaPlanilha, importarPlanilhaPonto, MAX_REGISTROS };
