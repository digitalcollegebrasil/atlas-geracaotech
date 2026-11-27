const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { dataDe, horaDe, tipoDe, diasDe, datasDoIntervalo, registrosDaPlanilha } = require('../services/pontoGestao');

const CAB = 'professor,turma,data_inicio,data_fim,dias_semana,entrada,saida,tipo,titulo,observacao';

describe('ponto da gestão: regras da planilha', () => {
  test('datas em ISO e em DD/MM/AAAA; data impossível é recusada', () => {
    assert.equal(dataDe('2026-03-02'), '2026-03-02');
    assert.equal(dataDe('02/03/2026'), '2026-03-02');
    assert.equal(dataDe('31/02/2026'), null);
    assert.equal(dataDe('amanhã'), null);
  });

  test('horas aceitam H:MM e HH:MM; hora 25 é recusada', () => {
    assert.equal(horaDe('8:05'), '08:05');
    assert.equal(horaDe('18:30'), '18:30');
    assert.equal(horaDe('25:00'), null);
    assert.equal(horaDe(''), null);
  });

  test('tipo: vazio ou aula = aula; extra = extra; outro valor é inválido', () => {
    assert.equal(tipoDe(''), 'aula');
    assert.equal(tipoDe('Regular'), 'aula');
    assert.equal(tipoDe('Extra'), 'extra');
    assert.equal(tipoDe('reposição'), null);
  });

  test('dias da semana aceitam vários separadores e recusam dia inventado', () => {
    assert.deepEqual([...diasDe('seg, qua')].sort(), [1, 3]);
    assert.deepEqual([...diasDe('ter;qui')].sort(), [2, 4]);
    assert.deepEqual([...diasDe('Sáb')], [6]);
    assert.equal(diasDe('funday'), null);
    assert.equal(diasDe('xyz'), null);
    assert.equal(diasDe('').size, 0);
  });

  test('intervalo gera um dia por data e respeita dias da semana', () => {
    // 2026-03-02 é segunda-feira; até 08/03 são 7 dias.
    assert.equal(datasDoIntervalo('2026-03-02', '2026-03-08', new Set()).length, 7);
    assert.deepEqual(datasDoIntervalo('2026-03-02', '2026-03-08', new Set([1, 3])), ['2026-03-02', '2026-03-04']);
  });

  test('linha válida vira um registro por dia, com a turma e o horário', () => {
    const csv = `${CAB}\nAna Souza,Turma A,02/03/2026,04/03/2026,,08:00,10:00,aula,,\n`;
    const { registros, erros } = registrosDaPlanilha(csv);
    assert.deepEqual(erros, []);
    assert.equal(registros.length, 3);
    assert.deepEqual(registros[0], { linha: 2, professor: 'Ana Souza', turma: 'Turma A', data: '2026-03-02', entrada: '08:00', saida: '10:00', tipo: 'aula', titulo: '', observacao: '' });
  });

  test('erros trazem o número da linha e nada é separado pela metade', () => {
    const csv = `${CAB}\nAna,,2026-03-02,,,10:00,08:00,aula,,\nBeto,,2026-03-02,,,08:00,10:00,extra,,\n`;
    const { registros, erros } = registrosDaPlanilha(csv);
    assert.equal(registros.length, 0);
    assert.ok(erros.some((e) => e.startsWith('Linha 2:') && e.includes('saída precisa ser depois')));
    assert.ok(erros.some((e) => e.startsWith('Linha 3:') && e.includes('título')));
  });

  test('coluna desconhecida é recusada em vez de ignorada', () => {
    assert.throws(() => registrosDaPlanilha('professor,sala\nAna,1\n'), /Colunas não reconhecidas: sala/);
  });

  test('intervalo acima do limite por linha é recusado', () => {
    const csv = `${CAB}\nAna,,2026-01-01,2027-12-31,,08:00,10:00,aula,,\n`;
    const { erros } = registrosDaPlanilha(csv);
    assert.ok(erros.some((e) => e.includes('passa de 366 dias')));
  });
});
