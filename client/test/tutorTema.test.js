import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estiloTutor, FORMATOS_TUTOR, APARENCIA_TUTOR_PADRAO } from '../src/components/ia/tutorTema.js';

describe('estilo do tutor', () => {
  test('sem configuração, usa o padrão do Atlas', () => {
    const e = estiloTutor(null);
    assert.equal(e['--tutor-fundo-personalizado'], APARENCIA_TUTOR_PADRAO.corFundo);
    assert.equal(e['--tutor-destaque'], APARENCIA_TUTOR_PADRAO.corDestaque);
    assert.equal(e['--tutor-raio'], FORMATOS_TUTOR.arredondado.raio);
  });

  test('cores e formato da configuração viram variáveis', () => {
    const e = estiloTutor({ corFundo: '#ffeedd', corDestaque: '#112233', formato: 'quadrado', fonte: 'lora' });
    assert.equal(e['--tutor-fundo-personalizado'], '#ffeedd');
    assert.equal(e['--tutor-destaque'], '#112233');
    assert.equal(e['--tutor-raio'], '6px');
    assert.equal(e['--tutor-raio-balao'], '3px');
    assert.match(e['--tutor-fonte'], /Lora/);
  });

  test('formato ou fonte desconhecidos caem no padrão', () => {
    const e = estiloTutor({ formato: 'estrela', fonte: 'comic' });
    assert.equal(e['--tutor-raio'], FORMATOS_TUTOR.arredondado.raio);
    assert.match(e['--tutor-fonte'], /system-ui/);
  });

  test('cada formato tem raio do cartão e dos balões', () => {
    Object.values(FORMATOS_TUTOR).forEach((f) => {
      assert.ok(f.raio && f.raioBalao, f.nome);
    });
  });
});
