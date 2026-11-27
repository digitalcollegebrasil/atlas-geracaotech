import { useEffect, useState } from 'react';
import {
  listarTurmasGt5, criarTurmaGt5, atualizarTurmaGt5, excluirTurmaGt5,
  importarPlanilhaGt5, baixarPlanilhaGt5, listarFormacoes, listarPolos,
} from '../../services/gt5';
import { errorText, FormActions } from '../manage/shared';
import { COLUNAS_PLANILHA, agruparTurmas, formatarData } from './gt5Format';
import UltimaSincronizacao from './UltimaSincronizacao';
import Campo from './Campo';

const NOVA_VAZIA = {
  codigo: '', curso: '', modalidade: 'Presencial', sede: '', nome: '',
  turno: '', dias_semana: '', horario: '', data_inicio: '', data_fim: '', ativa: true,
};

// Edição de uma turma na própria linha. Curso, modalidade e polo não mudam aqui.
function EditarTurma({ turma, onSalvar, onCancelar }) {
  const [v, setV] = useState({
    nome: turma.nome, turno: turma.turno, dias_semana: turma.dias_semana, horario: turma.horario,
    data_inicio: turma.data_inicio || '', data_fim: turma.data_fim || '', ativa: turma.ativa,
  });
  const set = (campo) => (e) => setV({ ...v, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <tr className="gt5-edicao">
      <td colSpan={6}>
        <form onSubmit={(e) => { e.preventDefault(); onSalvar(v); }}>
          <div className="form-grid">
            <Campo rotulo="Nome da turma"><input value={v.nome} onChange={set('nome')} maxLength={160} required /></Campo>
            <Campo rotulo="Turno"><input value={v.turno} onChange={set('turno')} maxLength={40} /></Campo>
            <Campo rotulo="Dias da semana"><input placeholder="ex.: seg;qua" value={v.dias_semana} onChange={set('dias_semana')} maxLength={60} /></Campo>
            <Campo rotulo="Horário"><input placeholder="ex.: 19:00-21:00" value={v.horario} onChange={set('horario')} maxLength={60} /></Campo>
            <Campo rotulo="Início"><input type="date" value={v.data_inicio} onChange={set('data_inicio')} /></Campo>
            <Campo rotulo="Término"><input type="date" value={v.data_fim} onChange={set('data_fim')} /></Campo>
          </div>
          <div className="gt5-acoes-grupo">
            <label className="checkbox-row">
              <input type="checkbox" checked={v.ativa} onChange={set('ativa')} />
              Turma ativa
            </label>
            <FormActions submitLabel="Salvar turma" onCancel={onCancelar} />
          </div>
        </form>
      </td>
    </tr>
  );
}

export default function TurmasTab({ onFeedback }) {
  const [turmas, setTurmas] = useState(null);
  const [sincronizacoes, setSincronizacoes] = useState({});
  const [formacoes, setFormacoes] = useState([]);
  const [polos, setPolos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarNova, setMostrarNova] = useState(false);
  const [nova, setNova] = useState(NOVA_VAZIA);
  const [erroNova, setErroNova] = useState(null);
  const [errosPlanilha, setErrosPlanilha] = useState(null);

  const carregar = () => listarTurmasGt5().then((dados) => {
    setTurmas(dados.turmas);
    setSincronizacoes(dados.sincronizacoes);
  });

  useEffect(() => {
    carregar().catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    listarFormacoes().then((d) => setFormacoes(d.formacoes)).catch(() => {});
    listarPolos().then((d) => setPolos(d.polos)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function criar(event) {
    event.preventDefault();
    setErroNova(null);
    try {
      await criarTurmaGt5({ ...nova, sede: nova.modalidade === 'Online' ? '' : nova.sede });
      setNova(NOVA_VAZIA);
      setMostrarNova(false);
      onFeedback({ type: 'success', text: 'Turma criada.' });
      carregar();
    } catch (error) {
      setErroNova(errorText(error));
    }
  }

  async function salvarEdicao(turma, dados) {
    try {
      await atualizarTurmaGt5(turma.id, dados);
      setEditandoId(null);
      onFeedback({ type: 'success', text: 'Turma atualizada.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function excluir(turma) {
    if (!window.confirm(`Excluir a turma "${turma.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await excluirTurmaGt5(turma.id);
      onFeedback({ type: 'success', text: 'Turma excluída.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  // A planilha é tudo ou nada: se houver erro, a lista de linhas aparece e nada é gravado.
  async function importar(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setErrosPlanilha(null);
    try {
      const texto = await arquivo.text();
      const r = await importarPlanilhaGt5(texto);
      onFeedback({ type: 'success', text: `Planilha importada: ${r.criadas} turmas criadas, ${r.atualizadas} atualizadas.` });
      carregar();
    } catch (error) {
      if (error.response?.data?.erros) setErrosPlanilha(error.response.data.erros);
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function exportar() {
    try {
      const blob = await baixarPlanilhaGt5();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'turmas-gt5.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  if (!turmas) return <p className="gt5-vazio">Carregando turmas…</p>;

  const grupos = agruparTurmas(turmas);

  return (
    <section className="gt5-secao">
      <div className="gt5-card">
        <div className="gt5-cabecalho">
          <div>
            <h2>Turmas</h2>
            <UltimaSincronizacao sincronizacoes={sincronizacoes} />
          </div>
          <div className="gt5-acoes-grupo">
            <button type="button" className="ghost-button small" onClick={exportar}>Baixar planilha</button>
            <label className="ghost-button small gt5-arquivo">
              Importar planilha
              <input type="file" accept=".csv,text/csv" onChange={importar} aria-label="Escolher planilha de turmas" />
            </label>
            <button type="button" className="primary-button small" onClick={() => setMostrarNova(!mostrarNova)}>
              {mostrarNova ? 'Fechar' : 'Nova turma'}
            </button>
          </div>
        </div>

        <details className="gt5-planilha">
          <summary>Como montar a planilha</summary>
          <p className="gt5-nota">
            Cabeçalho na primeira linha, em qualquer ordem. Separador vírgula ou ponto e vírgula. Até 500 turmas por envio.
            Linha com número de campos diferente do cabeçalho é recusada.
          </p>
          <div className="table-wrap">
            <table className="manage-table">
              <thead><tr><th>Coluna</th><th>Obrigatória</th><th>Como preencher</th></tr></thead>
              <tbody>
                {COLUNAS_PLANILHA.map((c) => (
                  <tr key={c.coluna}>
                    <td><code>{c.coluna}</code></td>
                    <td>{c.obrigatoria ? 'sim' : 'não'}</td>
                    <td>{c.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {errosPlanilha && (
        <div className="gt5-relatorio" role="alert">
          <p><strong>A planilha tem {errosPlanilha.length} erro(s). Nenhuma turma foi gravada.</strong> Corrija as linhas abaixo e envie de novo.</p>
          <div className="table-wrap">
            <table className="manage-table">
              <thead><tr><th>Linha</th><th>Erro</th></tr></thead>
              <tbody>
                {errosPlanilha.map((e) => <tr key={`${e.linha}-${e.erro}`}><td>{e.linha}</td><td>{e.erro}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mostrarNova && (
        <form className="gt5-card" onSubmit={criar}>
          <h2>Nova turma</h2>
          <div className="form-grid">
            <Campo rotulo="Formação">
              <select value={nova.curso} onChange={(e) => setNova({ ...nova, curso: e.target.value })} required>
                <option value="">Escolher…</option>
                {formacoes.map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Código da turma">
              <input placeholder="ex.: GT5-SOB-01" value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} maxLength={120} required />
            </Campo>
            <Campo rotulo="Modalidade">
              <select value={nova.modalidade} onChange={(e) => setNova({ ...nova, modalidade: e.target.value })}>
                <option value="Presencial">Presencial</option>
                <option value="Online">Online</option>
              </select>
            </Campo>
            {nova.modalidade === 'Presencial' && (
              <Campo rotulo="Polo">
                <select value={nova.sede} onChange={(e) => setNova({ ...nova, sede: e.target.value })}>
                  <option value="">Sem polo (Fortaleza, provisório)</option>
                  {polos.filter((p) => p.ativa).map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </Campo>
            )}
            <Campo rotulo="Nome da turma"><input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} maxLength={160} required /></Campo>
            <Campo rotulo="Turno"><input value={nova.turno} onChange={(e) => setNova({ ...nova, turno: e.target.value })} maxLength={40} /></Campo>
            <Campo rotulo="Dias da semana"><input placeholder="ex.: seg;qua" value={nova.dias_semana} onChange={(e) => setNova({ ...nova, dias_semana: e.target.value })} maxLength={60} /></Campo>
            <Campo rotulo="Horário"><input placeholder="ex.: 19:00-21:00" value={nova.horario} onChange={(e) => setNova({ ...nova, horario: e.target.value })} maxLength={60} /></Campo>
            <Campo rotulo="Início"><input type="date" value={nova.data_inicio} onChange={(e) => setNova({ ...nova, data_inicio: e.target.value })} /></Campo>
            <Campo rotulo="Término"><input type="date" value={nova.data_fim} onChange={(e) => setNova({ ...nova, data_fim: e.target.value })} /></Campo>
          </div>
          {erroNova && <p className="gt5-erro" role="alert">{erroNova}</p>}
          <FormActions submitLabel="Criar turma" onCancel={() => setMostrarNova(false)} />
        </form>
      )}

      {grupos.length === 0 && <p className="gt5-vazio">Nenhuma turma cadastrada. Importe a planilha ou crie uma turma.</p>}

      {grupos.map((grupo) => (
        <div key={grupo.formacao} className="gt5-card">
          <h2>{grupo.formacao}</h2>
          {grupo.locais.map((local) => (
            <div key={local.local} className="gt5-local">
              <h3>{local.local}</h3>
              <div className="table-wrap">
                <table className="manage-table">
                  <thead>
                    <tr>
                      <th>Turma</th>
                      <th>Dias e horário</th>
                      <th>Período</th>
                      <th>Alunos</th>
                      <th>Situação</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {local.turmas.map((t) => (editandoId === t.id ? (
                      <EditarTurma key={t.id} turma={t} onCancelar={() => setEditandoId(null)} onSalvar={(dados) => salvarEdicao(t, dados)} />
                    ) : (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.nome}</strong>
                          <span className="gt5-id">{t.codigo}</span>
                        </td>
                        <td>{[t.dias_semana, t.horario, t.turno].filter(Boolean).join(' · ') || '—'}</td>
                        <td>{formatarData(t.data_inicio)} a {formatarData(t.data_fim)}</td>
                        <td>{t.alunos}</td>
                        <td><span className={`badge${t.ativa ? '' : ' hidden'}`}>{t.ativa ? 'Ativa' : 'Inativa'}</span></td>
                        <td className="gt5-acoes">
                          <button type="button" className="ghost-button small" onClick={() => setEditandoId(t.id)}>Editar</button>
                          <button type="button" className="danger-button small" onClick={() => excluir(t)}>Excluir</button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
