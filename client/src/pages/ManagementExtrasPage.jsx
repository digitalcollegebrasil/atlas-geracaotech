import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { Feedback, errorText } from '../components/manage/shared';
import { exportTable } from '../utils/sheetExport';
import '../styles/reports.css';

const POR_PAGINA = 25;
const FILTRO_VAZIO = { busca: '', resultado: 'todos', de: '', ate: '' };

// Acessos: log de entradas e falhas. Somente administradores. Filtros vão ao servidor, sobre o histórico completo.
export function AccessLogPage() {
  const [filtros, setFiltros] = useState(FILTRO_VAZIO);
  const [events, setEvents] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pagina, setPagina] = useState(1);

  async function buscar(novos) {
    if (novos.de && novos.ate && novos.ate < novos.de) {
      setFeedback({ type: 'error', text: 'A data final precisa ser depois da inicial.' });
      return;
    }
    setCarregando(true);
    setFeedback(null);
    const params = { limit: 500 };
    if (novos.busca.trim()) params.busca = novos.busca.trim();
    if (novos.resultado !== 'todos') params.resultado = novos.resultado;
    if (novos.de) params.de = novos.de;
    if (novos.ate) params.ate = novos.ate;
    try {
      const { data } = await api.get('/reports/logins', { params });
      setEvents(data.events || []);
      setPagina(1);
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscar(FILTRO_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resultado e datas aplicam na hora; a busca por texto aplica ao enviar o formulário.
  function mudarFiltro(campo, valor) {
    const novos = { ...filtros, [campo]: valor };
    setFiltros(novos);
    if (campo !== 'busca') buscar(novos);
  }

  function limpar() {
    setFiltros(FILTRO_VAZIO);
    buscar(FILTRO_VAZIO);
  }

  const totalPaginas = Math.max(1, Math.ceil(events.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = events.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const filtrado = filtros.busca.trim() || filtros.resultado !== 'todos' || filtros.de || filtros.ate;

  const exportLog = (format) => {
    exportTable(
      events,
      [
        { label: 'Data', value: (e) => new Date(e.createdAt).toLocaleString('pt-BR') },
        { label: 'Nome', key: 'name' },
        { label: 'E-mail', key: 'email' },
        { label: 'Identificador usado', key: 'identifier' },
        { label: 'Resultado', value: (e) => (e.success ? 'Sucesso' : 'Falha') },
        { label: 'Motivo', key: 'reason' },
        { label: 'IP', key: 'ip' }
      ],
      format,
      'acessos-atlas'
    );
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <section className="section-heading">
          <h1>Acessos</h1>
          <p>Registro de entradas com sucesso e falhas. O CPF aparece apenas mascarado.</p>
        </section>

        <form className="users-filters" onSubmit={(event) => { event.preventDefault(); buscar(filtros); }}>
          <label>
            <span>Buscar</span>
            <input type="search" placeholder="Nome, e-mail, identificador, motivo ou IP" value={filtros.busca} onChange={(e) => mudarFiltro('busca', e.target.value)} />
          </label>
          <label>
            <span>Resultado</span>
            <select value={filtros.resultado} onChange={(e) => mudarFiltro('resultado', e.target.value)}>
              <option value="todos">Todos</option>
              <option value="sucesso">Sucesso</option>
              <option value="falha">Falha</option>
            </select>
          </label>
          <label>
            <span>De</span>
            <input type="date" value={filtros.de} onChange={(e) => mudarFiltro('de', e.target.value)} />
          </label>
          <label>
            <span>Até</span>
            <input type="date" value={filtros.ate} onChange={(e) => mudarFiltro('ate', e.target.value)} />
          </label>
          <div className="users-filter-actions">
            <button type="submit" className="ghost-button small" disabled={carregando}>Buscar</button>
            <button type="button" className="ghost-button small" onClick={limpar} disabled={carregando || !filtrado}>Limpar</button>
          </div>
        </form>

        <div className="ponto-acoes-exportar">
          <button type="button" className="ghost-button small" onClick={() => exportLog('xlsx')} disabled={!events.length}>Exportar .xlsx</button>
          <button type="button" className="ghost-button small" onClick={() => exportLog('csv')} disabled={!events.length}>Exportar .csv</button>
        </div>

        <Feedback feedback={feedback} />

        <div className="users-panel">
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr><th>Data</th><th>Conta</th><th>Identificador usado</th><th>Resultado</th><th>Motivo</th><th>IP</th></tr>
              </thead>
              <tbody>
                {visiveis.map((event) => (
                  <tr key={event.id}>
                    <td className="nowrap">{new Date(event.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="cell-name"><strong>{event.name || '—'}</strong><div className="muted">{event.email}</div></td>
                    <td className="nowrap">{event.identifier || '—'}</td>
                    <td className="nowrap"><span className={`report-account ${event.success ? 'report-account-ativa' : 'report-account-bloqueada'}`}>{event.success ? 'Sucesso' : 'Falha'}</span></td>
                    <td>{event.reason}</td>
                    <td className="nowrap">{event.ip}</td>
                  </tr>
                ))}
                {!carregando && events.length === 0 && <tr><td colSpan={6} className="users-empty">Nenhum acesso encontrado com estes filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          <nav className="pager" aria-label="Paginação dos acessos">
            <span className="muted">
              {events.length === 0 ? '0 registros' : `${(paginaAtual - 1) * POR_PAGINA + 1}–${Math.min(paginaAtual * POR_PAGINA, events.length)} de ${events.length} registros`}
            </span>
            <div className="pager-controls">
              <button type="button" className="ghost-button small" onClick={() => setPagina(paginaAtual - 1)} disabled={paginaAtual <= 1}>Anterior</button>
              <span>Página {paginaAtual} de {totalPaginas}</span>
              <button type="button" className="ghost-button small" onClick={() => setPagina(paginaAtual + 1)} disabled={paginaAtual >= totalPaginas}>Próxima</button>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
