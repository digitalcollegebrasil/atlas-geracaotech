const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseFormacao, montarVagas, localDe } = require('../services/gt5');
const { lerCsv, linhaParaTurma, COLUNAS } = require('../services/gt5Turmas');

const ATUAL = { carga_horaria: null, duracao_semanas: null, vagas_total: 400, vagas_online: 240, vagas_fortaleza: 40, vagas_interior: 120 };

function erro(fn) {
  try { fn(); } catch (e) { return e; }
  return null;
}

describe('edição da formação', () => {
  test('carga e duração podem ficar vazias, sem valor padrão', () => {
    const out = parseFormacao({ carga_horaria: '', duracao_semanas: null }, ATUAL);
    assert.equal(out.carga_horaria, null);
    assert.equal(out.duracao_semanas, null);
  });

  test('carga aceita número digitado como texto', () => {
    assert.equal(parseFormacao({ carga_horaria: '192' }, ATUAL).carga_horaria, 192);
  });

  test('vagas por local precisam somar o total', () => {
    assert.equal(erro(() => parseFormacao({ vagas_total: 500 }, ATUAL)).statusCode, 400);
    assert.equal(parseFormacao({ vagas_total: 500, vagas_interior: 220 }, ATUAL).vagas_interior, 220);
  });

  test('vagas não podem ser negativas nem fracionadas', () => {
    assert.equal(erro(() => parseFormacao({ vagas_interior: -1 }, ATUAL)).statusCode, 400);
    assert.equal(erro(() => parseFormacao({ vagas_online: 1.5 }, ATUAL)).statusCode, 400);
  });
});

describe('controle de vagas', () => {
  test('ocupação vem das matrículas e a disponibilidade é o que sobra', () => {
    const f = { vagas_total: 400, vagas_online: 240, vagas_fortaleza: 40, vagas_interior: 120 };
    const v = montarVagas(f, { online: 200, fortaleza: 40, interior: 130 });
    assert.deepEqual(v.online, { total: 240, ocupadas: 200, disponiveis: 40 });
    assert.deepEqual(v.fortaleza, { total: 40, ocupadas: 40, disponiveis: 0 });
    assert.deepEqual(v.interior, { total: 120, ocupadas: 130, disponiveis: -10 });
  });

  test('matrícula sem polo presencial conta como Fortaleza; com polo, como interior', () => {
    assert.equal(localDe('Online', null), 'online');
    assert.equal(localDe('Presencial', null), 'fortaleza');
    assert.equal(localDe('Presencial', 'uuid-do-polo'), 'interior');
  });
});

describe('planilha de turmas', () => {
  test('colunas são as definidas no documento de operação', () => {
    assert.deepEqual(COLUNAS, ['codigo', 'curso', 'modalidade', 'sede', 'nome', 'turno', 'dias_semana', 'horario', 'data_inicio', 'data_fim', 'ativa']);
  });

  test('lê campos com aspas e vírgulas dentro do texto', () => {
    const csv = 'codigo,curso,modalidade,nome\nT1,gt5-full-cycle-ai,Online,"Turma A, manhã"\n';
    const [linha] = lerCsv(csv);
    assert.equal(linha.nome, 'Turma A, manhã');
    assert.equal(linha._linha, 2);
  });

  test('aceita ponto e vírgula como separador e BOM do Excel', () => {
    const [linha] = lerCsv('﻿codigo;curso;modalidade\nT2;gt5-full-cycle-ai;Online\n');
    assert.equal(linha.codigo, 'T2');
  });

  test('coluna desconhecida e ausência de colunas obrigatórias são recusadas', () => {
    assert.equal(erro(() => lerCsv('codigo,curso,modalidade,cor\nT1,a,Online,azul')).statusCode, 400);
    assert.equal(erro(() => lerCsv('codigo,curso\nT1,a')).statusCode, 400);
  });

  test('"ativa" aceita sim/não e vazio fica sem valor', () => {
    const base = { codigo: 'T1', curso: 'c', modalidade: 'Online', sede: '', nome: '', turno: '', dias_semana: '', horario: '', data_inicio: '', data_fim: '' };
    assert.equal(linhaParaTurma({ ...base, ativa: 'sim' }).ativa, true);
    assert.equal(linhaParaTurma({ ...base, ativa: 'não' }).ativa, false);
    assert.equal(linhaParaTurma({ ...base, ativa: '' }).ativa, undefined);
    assert.equal(linhaParaTurma({ ...base, ativa: 'talvez' }).ativa, null);
    assert.equal(linhaParaTurma({ ...base, sede: '' }).sede, undefined);
  });
});
