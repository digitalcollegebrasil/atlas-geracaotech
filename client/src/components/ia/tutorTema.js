import { FONTES } from '../../utils/aparencia.js';

// Aparência do tutor: as opções vêm de listas fechadas (a gestão escolhe, não digita CSS).
// Pura, testada em client/test. A única parte com DOM é carregarFonteTutor.
export const FORMATOS_TUTOR = {
  quadrado: { nome: 'Quadrado', raio: '6px', raioBalao: '3px' },
  arredondado: { nome: 'Arredondado', raio: '22px', raioBalao: '16px' },
  pilula: { nome: 'Pílula', raio: '40px', raioBalao: '24px' },
};

export const APARENCIA_TUTOR_PADRAO = {
  nome: 'Atlas',
  mascote: null,
  corFundo: '#eef6fb',
  corDestaque: '#2a6f97',
  fonte: 'sistema',
  formato: 'arredondado',
};

export const MASCOTE_PADRAO = '/brand/atlas-mascote.gif';

// Variáveis CSS do tutor a partir da configuração. Quem usa precisa aplicar no elemento raiz do tutor.
export function estiloTutor(aparencia) {
  const a = { ...APARENCIA_TUTOR_PADRAO, ...(aparencia || {}) };
  const formato = FORMATOS_TUTOR[a.formato] || FORMATOS_TUTOR.arredondado;
  const fonte = FONTES[a.fonte] || FONTES.sistema;
  return {
    '--tutor-fundo-personalizado': a.corFundo,
    '--tutor-destaque': a.corDestaque,
    '--tutor-fonte': fonte.stack,
    '--tutor-raio': formato.raio,
    '--tutor-raio-balao': formato.raioBalao,
  };
}

// Carrega a fonte do Google quando o tutor usa uma fonte que o site ainda não carregou.
export function carregarFonteTutor(id) {
  const fonte = FONTES[id];
  if (!fonte?.google || typeof document === 'undefined') return;
  const link = document.getElementById(`fonte-tutor-${id}`) || document.createElement('link');
  if (!link.id) {
    link.id = `fonte-tutor-${id}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fonte.google}&display=swap`;
    document.head.appendChild(link);
  }
}
