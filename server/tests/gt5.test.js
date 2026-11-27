const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parsePolo, parseLideranca, parseVinculo, validarLocal, validarTurma } = require('../services/gt5');

const CURSO = '11111111-1111-4111-8111-111111111111';
const POLO = '22222222-2222-4222-8222-222222222222';
const OUTRO = '33333333-3333-4333-8333-333333333333';

function erro(fn) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}

// Vagas da seção 2 do documento (GT5-DIRETRIZES.md).
const DEV_IA_FIRST = { vagas_online: 600, vagas_fortaleza: 200, vagas_interior: 200 };
const PROJETOS_EMPRESAS = { vagas_online: 240, vagas_fortaleza: 40, vagas_interior: 120 };
const FULL_CYCLE = { vagas_online: 220, vagas_fortaleza: 80, vagas_interior: 0 };

describe('polos', () => {
  test('cadastro usa o nome como cidade e Ceará por padrão', () => {
    const p = parsePolo({ nome: 'Sobral' });
    assert.equal(p.nome, 'Sobral');
    assert.equal(p.cidade, 'Sobral');
    assert.equal(p.uf, 'CE');
  });

  test('nome é obrigatório e UF inválida é recusada', () => {
    assert.equal(erro(() => parsePolo({ cidade: 'Sobral' })).statusCode, 400);
    assert.equal(erro(() => parsePolo({ nome: 'Sobral', uf: 'XX' })).statusCode, 400);
  });

  test('atualização parcial não exige nome', () => {
    assert.deepEqual(parsePolo({ ativa: false }, { parcial: true }), { ativa: false });
  });
});

describe('lideranças territoriais', () => {
  test('e-mail inválido é recusado', () => {
    assert.equal(erro(() => parseLideranca({ nome: 'Ana', email: 'ana@' })).statusCode, 400);
  });

  test('polo precisa ser um UUID', () => {
    assert.equal(erro(() => parseLideranca({ nome: 'Ana', polo_id: 'sobral' })).statusCode, 400);
    assert.equal(parseLideranca({ nome: 'Ana', polo_id: POLO }).polo_id, POLO);
  });

  test('sem polo conhecido, o campo fica nulo', () => {
    assert.equal(parseLideranca({ nome: 'Ana', polo_id: '' }).polo_id, null);
  });
});

describe('vínculo do aluno', () => {
  test('modalidade precisa ser Online ou Presencial', () => {
    assert.equal(erro(() => parseVinculo({ formacao_id: CURSO, modalidade: 'Híbrido' })).statusCode, 400);
  });

  test('IDs inválidos viram 400', () => {
    assert.equal(erro(() => parseVinculo({ formacao_id: 'abc', modalidade: 'Online' })).statusCode, 400);
    assert.equal(erro(() => parseVinculo({ formacao_id: CURSO, modalidade: 'Presencial', polo_id: 'x' })).statusCode, 400);
  });

  test('Online não aceita polo', () => {
    assert.equal(erro(() => validarLocal(DEV_IA_FIRST, 'Online', POLO)).statusCode, 400);
  });

  test('Online exige vagas online na formação', () => {
    assert.equal(erro(() => validarLocal({ vagas_online: 0, vagas_fortaleza: 1, vagas_interior: 0 }, 'Online', null)).statusCode, 400);
    assert.equal(validarLocal(DEV_IA_FIRST, 'Online', null), undefined);
  });

  test('Presencial sem polo usa as vagas de Fortaleza', () => {
    assert.equal(validarLocal(DEV_IA_FIRST, 'Presencial', null), undefined);
    assert.equal(erro(() => validarLocal({ vagas_online: 1, vagas_fortaleza: 0, vagas_interior: 5 }, 'Presencial', null)).statusCode, 400);
  });

  test('Presencial com polo usa as vagas do interior, e Full Cycle AI não tem interior', () => {
    assert.equal(validarLocal(PROJETOS_EMPRESAS, 'Presencial', POLO), undefined);
    assert.equal(erro(() => validarLocal(FULL_CYCLE, 'Presencial', POLO)).statusCode, 400);
  });

  test('turma precisa ser da mesma formação, modalidade e polo do aluno', () => {
    const turma = { curso_id: CURSO, modalidade: 'Presencial', sede_id: POLO, ativa: true };
    const base = { cursoId: CURSO, modalidade: 'Presencial', poloId: POLO };
    assert.equal(validarTurma(turma, base), undefined);
    assert.equal(erro(() => validarTurma(null, base)).statusCode, 404);
    assert.equal(erro(() => validarTurma({ ...turma, curso_id: OUTRO }, base)).statusCode, 400);
    assert.equal(erro(() => validarTurma({ ...turma, modalidade: 'Online' }, base)).statusCode, 400);
    assert.equal(erro(() => validarTurma({ ...turma, sede_id: OUTRO }, base)).statusCode, 400);
    assert.equal(erro(() => validarTurma({ ...turma, ativa: false }, base)).statusCode, 400);
  });
});

describe('seed das formações (migração 046)', () => {
  test('as vagas por formação somam o total e batem com 1.700 no edital', () => {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', '046_gt5_cadastro_academico.sql'), 'utf8');
    const linhas = [...sql.matchAll(/\('(gt5-[a-z-]+)',\s*(?:\d+|null),\s*(?:\d+|null),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g)];
    assert.equal(linhas.length, 3);
    let soma = 0;
    for (const [, , total, online, fortaleza, interior] of linhas) {
      assert.equal(Number(online) + Number(fortaleza) + Number(interior), Number(total));
      soma += Number(total);
    }
    assert.equal(soma, 1700);
  });
});
