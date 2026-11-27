import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { Feedback, errorText } from '../components/manage/shared';
import { formatarMinutos, hora, dataBr, mesAtual } from '../utils/ponto';
import '../styles/docente.css';

const FUSO = 'America/Sao_Paulo';
const NOVO = { id: null, professorId: '', data: '', tipo: 'aula', turmaId: '', titulo: '', entrada: '', saida: '', observacao: '' };
const LOTE_VAZIO = { turmaId: '', tipo: '', observacao: '' };

// Professor ou monitor: a gestão distingue os dois na lista de ponto.
function rotuloResponsavel(p) {
  return p.papel === 'monitor' ? `${p.name} (monitor)` : p.name;
}

// Horário HH:MM de Brasília, para preencher o formulário de edição.
function horaSP(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Ponto dos professores (gestão). Inclui, edita (um ou vários), exclui e importa planilha. Tudo fica registrado como feito pela gestão.
export default function GestaoPontoPage() {
  const [periodo, setPeriodo] = useState(() => mesAtual());
  const [professorId, setProfessorId] = useState('');
  const [professores, setProfessores] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [formulario, setFormulario] = useState(null);
  const [lote, setLote] = useState(LOTE_VAZIO);
  const [errosImportacao, setErrosImportacao] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);

  function carregar() {
    setLoading(true);
    return api
      .get('/docente/gestao/ponto', { params: { de: periodo.de, ate: periodo.ate, professorId: professorId || undefined } })
      .then(({ data }) => {
        setRegistros(data.registros);
        setProfessores(data.professores);
        setTurmas(data.turmas || []);
        setSelecionados(new Set());
      })
      .catch((error) => setFeedback({ type: 'error', text: errorText(error) }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate, professorId]);

  const totalMinutos = registros.reduce((soma, r) => soma + (r.minutos || 0), 0);

  // Total de cada professor no período (o que a coordenação confere para a folha).
  const totaisPorProfessor = useMemo(() => {
    const mapa = new Map();
    for (const r of registros) {
      if (r.minutos === null || r.minutos === undefined) continue;
      mapa.set(r.professor, (mapa.get(r.professor) || 0) + r.minutos);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [registros]);

  const idsMarcados = [...selecionados];
  const todosMarcados = registros.length > 0 && selecionados.size === registros.length;

  function alternarSelecao(id) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(registros.map((r) => r.id)));
  }

  function abrirNovo() {
    setFeedback(null);
    setFormulario({ ...NOVO, professorId, data: periodo.ate });
  }

  function abrirEdicao(r) {
    setFeedback(null);
    setFormulario({
      id: r.id,
      professorId: r.professorId,
      data: r.data,
      tipo: r.tipo,
      turmaId: r.turmaId || '',
      titulo: r.titulo || '',
      entrada: horaSP(r.entrada),
      saida: horaSP(r.saida),
      observacao: r.observacao || ''
    });
  }

  async function salvarFormulario(event) {
    event.preventDefault();
    setSalvando(true);
    setFeedback(null);
    const corpo = {
      professorId: formulario.professorId,
      data: formulario.data,
      tipo: formulario.tipo,
      turmaId: formulario.turmaId || null,
      titulo: formulario.titulo.trim(),
      entrada: formulario.entrada,
      saida: formulario.saida || null,
      observacao: formulario.observacao.trim()
    };
    try {
      if (formulario.id) await api.patch(`/docente/gestao/ponto/${formulario.id}`, corpo);
      else await api.post('/docente/gestao/ponto', corpo);
      setFormulario(null);
      setFeedback({ type: 'success', text: formulario.id ? 'Registro atualizado.' : 'Registro incluído.' });
      carregar();
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  async function aplicarLote() {
    const corpo = { ids: idsMarcados, acao: 'editar' };
    if (lote.turmaId === 'nenhuma') corpo.turmaId = null;
    else if (lote.turmaId) corpo.turmaId = lote.turmaId;
    if (lote.tipo) corpo.tipo = lote.tipo;
    if (lote.observacao.trim()) corpo.observacao = lote.observacao.trim();
    if (corpo.turmaId === undefined && !corpo.tipo && !corpo.observacao) {
      setFeedback({ type: 'error', text: 'Escolha o que alterar nos registros selecionados.' });
      return;
    }
    setSalvando(true);
    setFeedback(null);
    try {
      const { data } = await api.post('/docente/gestao/ponto/lote', corpo);
      setLote(LOTE_VAZIO);
      setFeedback({ type: 'success', text: `${data.alterados} registro(s) atualizado(s).` });
      carregar();
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  async function excluirMarcados() {
    if (!window.confirm(`Excluir ${idsMarcados.length} registro(s)? Essa ação não pode ser desfeita.`)) return;
    setSalvando(true);
    setFeedback(null);
    try {
      const { data } = await api.post('/docente/gestao/ponto/lote', { ids: idsMarcados, acao: 'excluir' });
      setFeedback({ type: 'success', text: `${data.alterados} registro(s) excluído(s).` });
      carregar();
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  async function importarArquivo(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setImportando(true);
    setFeedback(null);
    setErrosImportacao([]);
    try {
      const csv = await arquivo.text();
      const { data } = await api.post('/docente/gestao/ponto/importar', { csv });
      setFeedback({ type: 'success', text: `${data.importados} registro(s) importado(s).` });
      carregar();
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error, 'Não foi possível importar a planilha.') });
      setErrosImportacao(error?.response?.data?.erros || []);
    } finally {
      setImportando(false);
    }
  }

  async function baixarModelo() {
    try {
      const { data } = await api.get('/docente/gestao/ponto/modelo', { responseType: 'blob' });
      baixar(new Blob([data], { type: 'text/csv;charset=utf-8' }), 'modelo-ponto-professores.csv');
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function exportar() {
    setExportando(true);
    setFeedback(null);
    try {
      const { data } = await api.get('/docente/gestao/ponto/exportar', {
        params: { de: periodo.de, ate: periodo.ate, professorId: professorId || undefined },
        responseType: 'blob'
      });
      baixar(new Blob([data], { type: 'text/csv;charset=utf-8' }), `ponto-professores-${periodo.de}-a-${periodo.ate}.csv`);
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setExportando(false);
    }
  }

  const editando = Boolean(formulario?.id);
  const ehExtra = formulario?.tipo === 'extra';

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content docente-ponto">
        <section className="welcome-banner">
          <div>
            <span className="eyebrow">Gestão</span>
            <h1>Ponto dos professores</h1>
            <p>Inclua, corrija e importe os registros do período. Os horários ficam marcados como feitos pela gestão.</p>
          </div>
        </section>

        <Feedback feedback={feedback} />

        <section className="surface-card docente-bloco">
          <header className="docente-bloco-cabecalho">
            <div className="docente-periodo">
              <label>
                <span>Professor</span>
                <select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
                  <option value="">Todos</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>{rotuloResponsavel(p)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>De</span>
                <input type="date" value={periodo.de} onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })} />
              </label>
              <label>
                <span>Até</span>
                <input type="date" value={periodo.ate} onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })} />
              </label>
            </div>
            <div className="docente-acoes">
              <span className="muted">Total no período: <strong>{formatarMinutos(totalMinutos)}</strong></span>
              <button type="button" className="primary-button small" onClick={abrirNovo}>Novo registro</button>
            </div>
          </header>

          <div className="ponto-acoes">
            <label className="ghost-button small">
              {importando ? 'Importando…' : 'Importar planilha'}
              <input type="file" accept=".csv,text/csv" hidden disabled={importando} onChange={importarArquivo} />
            </label>
            <button type="button" className="ghost-button small" onClick={baixarModelo}>Baixar modelo</button>
            <button type="button" className="ghost-button small" onClick={exportar} disabled={exportando || loading}>
              {exportando ? 'Exportando…' : 'Exportar CSV'}
            </button>
          </div>

          {errosImportacao.length > 0 && (
            <ul className="ponto-import-erros">
              {errosImportacao.map((erro) => <li key={erro}>{erro}</li>)}
            </ul>
          )}
        </section>

        {formulario && (
          <section className="surface-card docente-bloco">
            <header className="docente-bloco-cabecalho">
              <h2>{editando ? 'Editar registro' : 'Novo registro'}</h2>
            </header>
            <form className="ponto-formulario" onSubmit={salvarFormulario}>
              <label>
                <span>Professor</span>
                <select value={formulario.professorId} disabled={editando} onChange={(e) => setFormulario({ ...formulario, professorId: e.target.value })} required>
                  <option value="">Escolha</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>{rotuloResponsavel(p)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Data</span>
                <input type="date" value={formulario.data} onChange={(e) => setFormulario({ ...formulario, data: e.target.value })} required />
              </label>
              <label>
                <span>Tipo</span>
                <select value={formulario.tipo} onChange={(e) => setFormulario({ ...formulario, tipo: e.target.value })}>
                  <option value="aula">Aula</option>
                  <option value="extra">Aula extra</option>
                </select>
              </label>
              <label>
                <span>Turma</span>
                <select value={formulario.turmaId} onChange={(e) => setFormulario({ ...formulario, turmaId: e.target.value })}>
                  <option value="">Sem turma</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </label>
              {ehExtra && (
                <label className="ponto-campo-largo">
                  <span>Título da aula extra</span>
                  <input value={formulario.titulo} maxLength={120} onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })} required />
                </label>
              )}
              <label>
                <span>Entrada</span>
                <input type="time" value={formulario.entrada} onChange={(e) => setFormulario({ ...formulario, entrada: e.target.value })} required />
              </label>
              <label>
                <span>Saída</span>
                <input type="time" value={formulario.saida} onChange={(e) => setFormulario({ ...formulario, saida: e.target.value })} />
              </label>
              <label className="ponto-campo-largo">
                <span>Observação</span>
                <input value={formulario.observacao} maxLength={300} onChange={(e) => setFormulario({ ...formulario, observacao: e.target.value })} />
              </label>
              <div className="ponto-formulario-acoes">
                <button type="submit" className="primary-button small" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
                <button type="button" className="ghost-button small" onClick={() => setFormulario(null)}>Cancelar</button>
              </div>
            </form>
          </section>
        )}

        {selecionados.size > 0 && (
          <section className="ponto-lote" aria-label="Alterar registros selecionados">
            <span className="ponto-lote-texto">{selecionados.size} selecionado(s)</span>
            <label>
              <span>Turma</span>
              <select value={lote.turmaId} onChange={(e) => setLote({ ...lote, turmaId: e.target.value })}>
                <option value="">Manter</option>
                <option value="nenhuma">Sem turma</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Tipo</span>
              <select value={lote.tipo} onChange={(e) => setLote({ ...lote, tipo: e.target.value })}>
                <option value="">Manter</option>
                <option value="aula">Aula</option>
                <option value="extra">Aula extra</option>
              </select>
            </label>
            <label>
              <span>Observação</span>
              <input value={lote.observacao} maxLength={300} placeholder="Manter" onChange={(e) => setLote({ ...lote, observacao: e.target.value })} />
            </label>
            <div className="docente-acoes">
              <button type="button" className="primary-button small" onClick={aplicarLote} disabled={salvando}>Aplicar</button>
              <button type="button" className="danger-button small" onClick={excluirMarcados} disabled={salvando}>Excluir</button>
              <button type="button" className="ghost-button small" onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
            </div>
          </section>
        )}

        <section className="surface-card docente-bloco">
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th className="col-marcar">
                    <input type="checkbox" className="ponto-marcar" aria-label="Selecionar todos" checked={todosMarcados} onChange={alternarTodos} disabled={!registros.length} />
                  </th>
                  <th>Professor</th><th>Data</th><th>Tipo</th><th>Turma / título</th><th>Horário</th><th>Duração</th><th>Observação</th><th />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className={selecionados.has(r.id) ? 'ponto-marcada' : undefined}>
                    <td className="col-marcar">
                      <input type="checkbox" className="ponto-marcar" aria-label={`Selecionar registro de ${r.professor}`} checked={selecionados.has(r.id)} onChange={() => alternarSelecao(r.id)} />
                    </td>
                    <td className="cell-name"><strong>{r.professor}</strong></td>
                    <td className="nowrap">{dataBr(r.data)}</td>
                    <td className="nowrap">{r.tipo === 'extra' ? 'Extra' : 'Aula'}</td>
                    <td>{r.tipo === 'extra' ? `${r.titulo || 'Aula extra'}${r.turma ? ` · ${r.turma}` : ''}` : r.turma || '—'}</td>
                    <td className="nowrap">
                      {hora(r.entrada)} – {r.saida ? hora(r.saida) : <span className="docente-aberto">aberto</span>}
                    </td>
                    <td className="nowrap">{r.minutos !== null ? formatarMinutos(r.minutos) : '—'}</td>
                    <td>
                      {r.observacao || '—'}
                      {r.corrigido && <small className="docente-origem"> · corrigido pela gestão</small>}
                    </td>
                    <td className="col-acao">
                      <button type="button" className="ghost-button small" onClick={() => abrirEdicao(r)}>Editar</button>
                    </td>
                  </tr>
                ))}
                {!loading && registros.length === 0 && (
                  <tr><td colSpan={9} className="users-empty">Nenhum registro de ponto neste período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {totaisPorProfessor.length > 0 && (
          <section className="surface-card docente-bloco">
            <header className="docente-bloco-cabecalho">
              <h2>Total por professor</h2>
            </header>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr><th>Professor</th><th>Duração no período</th></tr>
                </thead>
                <tbody>
                  {totaisPorProfessor.map(([nome, minutos]) => (
                    <tr key={nome}>
                      <td className="cell-name"><strong>{nome}</strong></td>
                      <td className="nowrap">{formatarMinutos(minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
