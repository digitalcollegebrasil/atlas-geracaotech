import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_PLANILHA, formatarData, resumoVagas, rotuloLocalTurma, agruparTurmas, ordenarPorInicio, vagasConferem,
} from '../src/components/gt5/gt5Format.js';

describe('datas', () => {
  test('mostra a data no formato brasileiro', () => {
    assert.equal(formatarData('2027-03-01'), '01/03/2027');
  });

  test('sem data, mostra um traço', () => {
    assert.equal(formatarData(null), '—');
    assert.equal(formatarData(''), '—');
  });
});

describe('vagas', () => {
  test('resumo mostra ocupadas e livres', () => {
    assert.equal(resumoVagas({ ocupadas: 12, disponiveis: 28 }), '12 ocupadas · 28 livres');
  });

  test('a soma das vagas por local precisa bater com o total', () => {
    assert.equal(vagasConferem({ total: 1000, online: 600, fortaleza: 200, interior: 200 }), true);
    assert.equal(vagasConferem({ total: 1000, online: 600, fortaleza: 200, interior: 100 }), false);
  });

  test('valores digitados como texto são somados como número', () => {
    assert.equal(vagasConferem({ total: '400', online: '240', fortaleza: '40', interior: '120' }), true);
  });
});

describe('locais das turmas', () => {
  test('online não tem polo', () => {
    assert.equal(rotuloLocalTurma({ modalidade: 'Online', polo: null }), 'Online');
  });

  test('presencial com polo mostra o polo', () => {
    assert.equal(rotuloLocalTurma({ modalidade: 'Presencial', polo: 'Sobral' }), 'Polo Sobral');
  });

  test('presencial sem polo fica marcado como Fortaleza provisória', () => {
    assert.equal(rotuloLocalTurma({ modalidade: 'Presencial', polo: null }), 'Presencial sem polo (Fortaleza, provisório)');
  });
});

describe('agrupamento da listagem', () => {
  const turmas = [
    { formacao: 'IA First', modalidade: 'Presencial', polo: 'Sobral', nome: 'B' },
    { formacao: 'IA First', modalidade: 'Online', polo: null, nome: 'A' },
    { formacao: 'IA First', modalidade: 'Presencial', polo: 'Sobral', nome: 'C' },
    { formacao: 'Full Cycle', modalidade: 'Presencial', polo: null, nome: 'D' },
  ];

  test('agrupa por formação e depois por local, mantendo a ordem de chegada', () => {
    const grupos = agruparTurmas(turmas);
    assert.deepEqual(grupos.map((g) => g.formacao), ['IA First', 'Full Cycle']);
    assert.deepEqual(grupos[0].locais.map((l) => l.local), ['Polo Sobral', 'Online']);
    assert.deepEqual(grupos[0].locais[0].turmas.map((t) => t.nome), ['B', 'C']);
  });

  test('lista vazia gera grupos vazios', () => {
    assert.deepEqual(agruparTurmas([]), []);
  });
});

describe('calendário', () => {
  test('ordena pela data de início e deixa as sem data por último', () => {
    const lista = [
      { nome: 'Sem data', data_inicio: null },
      { nome: 'Tarde', data_inicio: '2027-06-01' },
      { nome: 'Cedo', data_inicio: '2027-03-01' },
    ];
    assert.deepEqual(ordenarPorInicio(lista).map((t) => t.nome), ['Cedo', 'Tarde', 'Sem data']);
  });

  test('não altera a lista original', () => {
    const lista = [{ nome: 'B', data_inicio: '2027-06-01' }, { nome: 'A', data_inicio: '2027-03-01' }];
    ordenarPorInicio(lista);
    assert.equal(lista[0].nome, 'B');
  });
});

describe('planilha documentada na tela', () => {
  test('lista as colunas que a importação aceita, com as obrigatórias marcadas', () => {
    const obrigatorias = COLUNAS_PLANILHA.filter((c) => c.obrigatoria).map((c) => c.coluna);
    assert.deepEqual(obrigatorias, ['codigo', 'curso', 'modalidade']);
    assert.equal(COLUNAS_PLANILHA.length, 11);
  });
});
