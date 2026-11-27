const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizar } = require('../services/manualRegras');
const PADRAO = require('../services/manualPadrao');

test('conteúdo inicial do manual é aceito e recebe ids', () => {
  const secoes = normalizar({ secoes: PADRAO.map((s) => ({ titulo: s.titulo, perguntas: s.perguntas })) });
  assert.equal(secoes.length, PADRAO.length);
  assert.ok(secoes.every((s) => s.id && s.perguntas.every((p) => p.id)));
});

test('rejeita link para fora do Atlas', () => {
  assert.throws(
    () => normalizar({ secoes: [{ titulo: 'x', perguntas: [{ p: 'a', r: 'b', links: [{ to: 'https://exemplo.com', label: 'l' }] }] }] }),
    /começar com \//
  );
});

test('rejeita título vazio e resposta longa demais', () => {
  assert.throws(() => normalizar({ secoes: [{ titulo: '  ', perguntas: [] }] }), /não pode ficar vazio/);
  assert.throws(
    () => normalizar({ secoes: [{ titulo: 'x', perguntas: [{ p: 'a', r: 'r'.repeat(2001), links: [] }] }] }),
    /máximo 2000/
  );
});
