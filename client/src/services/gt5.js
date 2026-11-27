import api from './api';

// Geração Tech 5.0: gestão do cadastro acadêmico (só administração). Ver docs/GT5-DIRETRIZES.md.
export const listarFormacoes = () => api.get('/gt5/formacoes').then((r) => r.data);
export const atualizarFormacao = (id, dados) => api.patch(`/gt5/formacoes/${id}`, dados).then((r) => r.data);

export const obterConfiguracaoGt5 = () => api.get('/gt5/configuracao').then((r) => r.data);
export const atualizarConfiguracaoGt5 = (dados) => api.patch('/gt5/configuracao', dados).then((r) => r.data);

export const listarPolos = () => api.get('/gt5/polos').then((r) => r.data);
export const criarPolo = (dados) => api.post('/gt5/polos', dados).then((r) => r.data);
export const atualizarPolo = (id, dados) => api.patch(`/gt5/polos/${id}`, dados).then((r) => r.data);
export const excluirPolo = (id) => api.delete(`/gt5/polos/${id}`).then((r) => r.data);

export const listarLiderancas = (poloId) =>
  api.get('/gt5/liderancas', { params: poloId ? { polo_id: poloId } : {} }).then((r) => r.data);
export const criarLideranca = (dados) => api.post('/gt5/liderancas', dados).then((r) => r.data);
export const atualizarLideranca = (id, dados) => api.patch(`/gt5/liderancas/${id}`, dados).then((r) => r.data);
export const excluirLideranca = (id) => api.delete(`/gt5/liderancas/${id}`).then((r) => r.data);

export const listarTurmasGt5 = () => api.get('/gt5/turmas').then((r) => r.data);
export const criarTurmaGt5 = (dados) => api.post('/gt5/turmas', dados).then((r) => r.data);
export const atualizarTurmaGt5 = (id, dados) => api.patch(`/gt5/turmas/${id}`, dados).then((r) => r.data);
export const excluirTurmaGt5 = (id) => api.delete(`/gt5/turmas/${id}`).then((r) => r.data);

// Importação: o texto CSV vai no corpo. Se houver erro, a API devolve a lista de linhas em "erros".
export const importarPlanilhaGt5 = (csv) => api.post('/gt5/turmas/importar', { csv }).then((r) => r.data);
export const baixarPlanilhaGt5 = () => api.get('/gt5/turmas/exportar', { responseType: 'blob' }).then((r) => r.data);
