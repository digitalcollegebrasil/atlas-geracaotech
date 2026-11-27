const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const gt5 = require('../services/gt5');
const turmas = require('../services/gt5Turmas');

function erro(fn) {
  try { fn(); } catch (e) { return e; }
  return null;
}

// Cliente de teste: responde com as linhas dadas, sem banco.
function clienteComLinhas(rows) {
  return { query: async () => ({ rows }) };
}

describe('regra de matrícula concluída e vaga', () => {
  test('por padrão só matrícula ativa ocupa vaga', () => {
    assert.deepEqual(gt5.situacoesPorConfiguracao(false), ['ativo']);
  });

  test('quando a gestão liga a regra, concluída também ocupa', () => {
    assert.deepEqual(gt5.situacoesPorConfiguracao(true), ['ativo', 'concluido']);
  });

  test('sem linha de configuração, vale o padrão', async () => {
    assert.deepEqual(await gt5.situacoesQueOcupam(clienteComLinhas([])), ['ativo']);
  });

  test('lê o valor da configuração do banco', async () => {
    assert.deepEqual(await gt5.situacoesQueOcupam(clienteComLinhas([{ valor: true }])), ['ativo', 'concluido']);
  });
});

describe('Fortaleza provisória', () => {
  test('é provisória enquanto não há sede de Fortaleza cadastrada', async () => {
    assert.equal(await gt5.fortalezaProvisoria(clienteComLinhas([])), true);
  });

  test('deixa de ser provisória quando existe sede de Fortaleza', async () => {
    assert.equal(await gt5.fortalezaProvisoria(clienteComLinhas([{ '?column?': 1 }])), false);
  });
});

describe('edição da turma', () => {
  test('edita só os campos informados e aceita texto vazio em turno e horário', () => {
    const out = gt5.parseEdicaoTurma({ turno: '', horario: '19:00-21:00', ativa: 0 });
    assert.deepEqual(out, { turno: '', horario: '19:00-21:00', ativa: false });
  });

  test('datas usam AAAA-MM-DD', () => {
    assert.equal(gt5.parseEdicaoTurma({ data_inicio: '2027-03-01' }).data_inicio, '2027-03-01');
    assert.equal(erro(() => gt5.parseEdicaoTurma({ data_inicio: '01/03/2027' })).statusCode, 400);
  });

  test('data vazia limpa a data', () => {
    assert.equal(gt5.parseEdicaoTurma({ data_fim: '' }).data_fim, null);
  });

  test('nome não pode ficar vazio', () => {
    assert.equal(erro(() => gt5.parseEdicaoTurma({ nome: '   ' })).statusCode, 400);
  });

  test('término não pode ser anterior ao início', () => {
    assert.equal(erro(() => gt5.validarPeriodo('2027-05-31', '2027-03-01')).statusCode, 400);
    assert.equal(erro(() => gt5.validarPeriodo('2027-03-01', '2027-05-31')), null);
    assert.equal(erro(() => gt5.validarPeriodo(null, '2027-05-31')), null);
  });

  test('turma com registros ligados mostra o total de vínculos', async () => {
    assert.equal(await gt5.vinculosDaTurma(clienteComLinhas([{ total: 0 }]), 'x'), 0);
    assert.equal(await gt5.vinculosDaTurma(clienteComLinhas([{ total: 3 }]), 'x'), 3);
  });

  test('polo em uso mostra o total de vínculos', async () => {
    assert.equal(await gt5.vinculosDoPolo(clienteComLinhas([{ total: 2 }]), 'x'), 2);
  });
});

describe('integração em JSON (mesma regra da planilha)', () => {
  test('aceita lista de objetos com as colunas da planilha', () => {
    const [r] = turmas.registrosDeLista([{ codigo: 'GT5-SOB-01', curso: 'gt5-desenvolvedor-ia-first', modalidade: 'Presencial', sede: 'Sobral', nome: 'Turma Sobral 1', ativa: true }]);
    assert.equal(r._linha, 1);
    assert.equal(r.ativa, 'true');
    assert.equal(r.turno, '');
    const linha = turmas.linhaParaTurma(r);
    assert.equal(linha.ativa, true);
    assert.equal(linha.sede, 'Sobral');
  });

  test('recusa coluna que não existe', () => {
    assert.equal(erro(() => turmas.registrosDeLista([{ codigo: 'x', cor: 'azul' }])).statusCode, 400);
  });

  test('recusa quando não é lista', () => {
    assert.equal(erro(() => turmas.registrosDeLista({ codigo: 'x' })).statusCode, 400);
  });

  test('recusa lote acima do limite', () => {
    const lista = Array.from({ length: 501 }, (_, i) => ({ codigo: `T${i}` }));
    assert.equal(erro(() => turmas.registrosDeLista(lista)).statusCode, 400);
  });

  test('recusa item que não é objeto', () => {
    assert.equal(erro(() => turmas.registrosDeLista(['GT5-01'])).statusCode, 400);
  });
});

describe('exportação da planilha', () => {
  test('célula com separador ou aspas vai entre aspas', () => {
    assert.equal(turmas.celulaCsv('Turma A, noite'), '"Turma A, noite"');
    assert.equal(turmas.celulaCsv('diz "oi"'), '"diz ""oi"""');
    assert.equal(turmas.celulaCsv('seg;qua'), '"seg;qua"');
    assert.equal(turmas.celulaCsv(null), '');
  });

  test('quebra de linha vira espaço', () => {
    assert.equal(turmas.celulaCsv('linha 1\nlinha 2'), 'linha 1 linha 2');
  });

  test('o que sai pela exportação entra de volta na importação sem mudar nada', async () => {
    const linhas = [
      { codigo: 'GT5-SOB-01', curso: 'gt5-desenvolvedor-ia-first', modalidade: 'Presencial', sede: 'Sobral', nome: 'Turma Sobral, noite',
        turno: 'noite', dias_semana: 'seg;qua', horario: '19:00-21:00', data_inicio: '2027-03-01', data_fim: '2027-05-31', ativa: true },
      { codigo: 'GT5-ON-01', curso: 'gt5-desenvolvedor-ia-first', modalidade: 'Online', sede: null, nome: 'Turma "Online" 1',
        turno: '', dias_semana: '', horario: '', data_inicio: null, data_fim: null, ativa: false },
    ];
    const csv = await turmas.exportarCsv(clienteComLinhas(linhas));
    assert.ok(csv.startsWith('﻿'), 'começa com BOM para o Excel');

    const registros = turmas.lerCsv(csv);
    assert.equal(registros.length, 2);
    const ida = registros.map((r) => turmas.linhaParaTurma(r));
    assert.equal(ida[0].nome, 'Turma Sobral, noite');
    assert.equal(ida[0].dias_semana, 'seg;qua');
    assert.equal(ida[0].ativa, true);
    assert.equal(ida[0].data_fim, '2027-05-31');
    assert.equal(ida[1].nome, 'Turma "Online" 1');
    assert.equal(ida[1].sede, undefined);
    assert.equal(ida[1].data_inicio, undefined);
    assert.equal(ida[1].ativa, false);
  });

  test('exportação sem turmas sai só com o cabeçalho', async () => {
    const csv = await turmas.exportarCsv(clienteComLinhas([]));
    assert.equal(csv, '﻿' + turmas.COLUNAS.join(',') + '\r\n');
    assert.equal(turmas.lerCsv(csv).length, 0);
  });
});
