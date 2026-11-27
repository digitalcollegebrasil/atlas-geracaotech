const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { normalizar, PADRAO, FONTES, FORMATOS } = require('../services/iaAparenciaRegras');

function erro(fn) {
  try { fn(); } catch (e) { return e; }
  return null;
}

describe('aparência do tutor', () => {
  test('sem dados, usa o padrão do Atlas', () => {
    const c = normalizar({});
    assert.equal(c.nome, 'Atlas');
    assert.equal(c.mascoteCaminho, null);
    assert.equal(c.corFundo, PADRAO.corFundo);
    assert.equal(c.corDestaque, PADRAO.corDestaque);
    assert.equal(c.fonte, 'sistema');
    assert.equal(c.formato, 'arredondado');
  });

  test('nome é aparado e limitado a 40 caracteres', () => {
    assert.equal(normalizar({ nome: '  Ana  ' }).nome, 'Ana');
    assert.equal(erro(() => normalizar({ nome: '   ' })).statusCode, 400);
    assert.equal(erro(() => normalizar({ nome: 'x'.repeat(41) })).statusCode, 400);
    assert.equal(normalizar({ nome: 'x'.repeat(40) }).nome.length, 40);
  });

  test('cores aceitam só #RRGGBB e saem em minúsculas', () => {
    assert.equal(normalizar({ corDestaque: '#ABCDEF' }).corDestaque, '#abcdef');
    assert.equal(erro(() => normalizar({ corDestaque: 'azul' })).statusCode, 400);
    assert.equal(erro(() => normalizar({ corFundo: '#abc' })).statusCode, 400);
    assert.equal(erro(() => normalizar({ corFundo: 'red;background:url(x)' })).statusCode, 400);
  });

  test('fonte e formato fora da lista voltam ao padrão', () => {
    assert.equal(normalizar({ fonte: 'Comic Sans' }).fonte, 'sistema');
    assert.equal(normalizar({ formato: 'estrela' }).formato, 'arredondado');
  });

  test('todas as fontes e formatos da lista são aceitos', () => {
    FONTES.forEach((fonte) => assert.equal(normalizar({ fonte }).fonte, fonte));
    FORMATOS.forEach((formato) => assert.equal(normalizar({ formato }).formato, formato));
  });

  test('imagem do tutor aceita caminho de mídia e recusa caminho suspeito', () => {
    assert.equal(normalizar({ mascoteCaminho: 'ia/tutor-123.gif' }).mascoteCaminho, 'ia/tutor-123.gif');
    assert.equal(normalizar({ mascoteCaminho: '' }).mascoteCaminho, null);
    assert.equal(erro(() => normalizar({ mascoteCaminho: '../../etc/passwd' })).statusCode, 400);
    assert.equal(erro(() => normalizar({ mascoteCaminho: 'a b.gif' })).statusCode, 400);
    assert.equal(erro(() => normalizar({ mascoteCaminho: 'x'.repeat(301) })).statusCode, 400);
  });
});
