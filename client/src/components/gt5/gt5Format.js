// Funções puras da tela GT 5.0: textos, datas e agrupamentos. Testadas em client/test.

// Colunas da planilha de turmas. A mesma lista aparece na tela e no PR.
export const COLUNAS_PLANILHA = [
  { coluna: 'codigo', obrigatoria: true, descricao: 'Código da turma. É a chave: o mesmo código atualiza a turma existente.' },
  { coluna: 'curso', obrigatoria: true, descricao: 'gt5-desenvolvedor-ia-first, gt5-projetos-ia-empresas ou gt5-full-cycle-ai.' },
  { coluna: 'modalidade', obrigatoria: true, descricao: 'Online ou Presencial.' },
  { coluna: 'sede', obrigatoria: false, descricao: 'Nome do polo (Sobral, Juazeiro do Norte, Limoeiro do Norte). Vazio = online ou Fortaleza.' },
  { coluna: 'nome', obrigatoria: false, descricao: 'Nome da turma. Obrigatório só para turma nova.' },
  { coluna: 'turno', obrigatoria: false, descricao: 'Texto livre.' },
  { coluna: 'dias_semana', obrigatoria: false, descricao: 'Texto livre, ex.: seg;qua.' },
  { coluna: 'horario', obrigatoria: false, descricao: 'Texto livre, ex.: 19:00-21:00.' },
  { coluna: 'data_inicio', obrigatoria: false, descricao: 'Data no formato AAAA-MM-DD.' },
  { coluna: 'data_fim', obrigatoria: false, descricao: 'Data no formato AAAA-MM-DD.' },
  { coluna: 'ativa', obrigatoria: false, descricao: 'sim ou não. Vazio mantém o valor atual.' },
];

export const LOCAIS = { online: 'Online', fortaleza: 'Fortaleza', interior: 'Interior' };

// "19/03/2027" a partir de "2027-03-19". Sem data, um traço.
export function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—';
}

export function formatarDataHora(valor) {
  if (!valor) return 'nunca';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// "12 de 40 · 28 livres". Ocupadas vêm das matrículas sincronizadas, nunca de digitação.
export function resumoVagas(linha) {
  return `${linha.ocupadas} ocupadas · ${linha.disponiveis} livres`;
}

// Rótulo do local onde a turma acontece. Presencial sem polo fica como Fortaleza provisória.
export function rotuloLocalTurma(turma) {
  if (turma.modalidade === 'Online') return 'Online';
  if (turma.polo) return `Polo ${turma.polo}`;
  return 'Presencial sem polo (Fortaleza, provisório)';
}

// Agrupa turmas por formação e depois por local, na ordem da tela: formação > polo > turma.
export function agruparTurmas(turmas) {
  const formacoes = new Map();
  for (const turma of turmas) {
    if (!formacoes.has(turma.formacao)) formacoes.set(turma.formacao, new Map());
    const locais = formacoes.get(turma.formacao);
    const rotulo = rotuloLocalTurma(turma);
    if (!locais.has(rotulo)) locais.set(rotulo, []);
    locais.get(rotulo).push(turma);
  }
  return [...formacoes.entries()].map(([formacao, locais]) => ({
    formacao,
    locais: [...locais.entries()].map(([local, lista]) => ({ local, turmas: lista })),
  }));
}

// Ordena por data de início (sem data, por último). Usado no calendário.
export function ordenarPorInicio(turmas) {
  return [...turmas].sort((a, b) => {
    if (!a.data_inicio && !b.data_inicio) return a.nome.localeCompare(b.nome);
    if (!a.data_inicio) return 1;
    if (!b.data_inicio) return -1;
    return a.data_inicio.localeCompare(b.data_inicio) || a.nome.localeCompare(b.nome);
  });
}

// Vagas por local somam o total? Mesma conta que a API faz, para avisar antes de salvar.
export function vagasConferem(v) {
  const soma = Number(v.online) + Number(v.fortaleza) + Number(v.interior);
  return soma === Number(v.total);
}
