import { useEffect, useState } from 'react';
import { listarPolos, listarLiderancas, criarLideranca, atualizarLideranca, excluirLideranca } from '../../services/gt5';
import { errorText } from '../manage/shared';

const VAZIO = { nome: '', polo_id: '', email: '', telefone: '' };

// Lideranças territoriais (16 previstas no documento). Cadastro manual; os dados ainda não foram informados.
export default function LiderancasTab({ onFeedback }) {
  const [polos, setPolos] = useState([]);
  const [filtroPolo, setFiltroPolo] = useState('');
  const [liderancas, setLiderancas] = useState(null);
  const [nova, setNova] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState(VAZIO);

  const carregar = () => listarLiderancas(filtroPolo).then((dados) => setLiderancas(dados.liderancas));

  useEffect(() => {
    listarPolos().then((dados) => setPolos(dados.polos)).catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregar().catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPolo]);

  const payload = (v) => ({ nome: v.nome, email: v.email, telefone: v.telefone, polo_id: v.polo_id || null });

  async function incluir(event) {
    event.preventDefault();
    try {
      await criarLideranca(payload(nova));
      setNova(VAZIO);
      onFeedback({ type: 'success', text: 'Liderança incluída.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function salvarEdicao(lideranca) {
    try {
      await atualizarLideranca(lideranca.id, payload(rascunho));
      setEditandoId(null);
      onFeedback({ type: 'success', text: 'Liderança atualizada.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function excluir(lideranca) {
    if (!window.confirm(`Excluir a liderança "${lideranca.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await excluirLideranca(lideranca.id);
      onFeedback({ type: 'success', text: 'Liderança excluída.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  const seletorPolo = (valor, onChange, rotulo) => (
    <select aria-label={rotulo} value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sem polo</option>
      {polos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
  );

  return (
    <section className="gt5-secao">
      <form className="gt5-linha-form gt5-grade" onSubmit={incluir}>
        <input aria-label="Nome da liderança" placeholder="Nome" value={nova.nome} maxLength={160} onChange={(e) => setNova({ ...nova, nome: e.target.value })} required />
        {seletorPolo(nova.polo_id, (polo_id) => setNova({ ...nova, polo_id }), 'Polo da liderança')}
        <input aria-label="E-mail da liderança" placeholder="E-mail" type="email" value={nova.email} onChange={(e) => setNova({ ...nova, email: e.target.value })} />
        <input aria-label="Telefone da liderança" placeholder="Telefone com DDD" value={nova.telefone} onChange={(e) => setNova({ ...nova, telefone: e.target.value })} />
        <button type="submit" className="primary-button small">Incluir</button>
      </form>

      <label className="gt5-filtro">
        Mostrar
        {' '}
        <select aria-label="Filtrar lideranças por polo" value={filtroPolo} onChange={(e) => setFiltroPolo(e.target.value)}>
          <option value="">Todos os polos</option>
          {polos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>

      {!liderancas ? <p className="gt5-vazio">Carregando lideranças…</p> : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Polo</th>
              <th>Contato</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {liderancas.map((l) => (editandoId === l.id ? (
              <tr key={l.id}>
                <td><input aria-label="Nome" value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} /></td>
                <td>{seletorPolo(rascunho.polo_id, (polo_id) => setRascunho({ ...rascunho, polo_id }), 'Polo')}</td>
                <td>
                  <input aria-label="E-mail" value={rascunho.email} onChange={(e) => setRascunho({ ...rascunho, email: e.target.value })} />
                  <input aria-label="Telefone" value={rascunho.telefone} onChange={(e) => setRascunho({ ...rascunho, telefone: e.target.value })} />
                </td>
                <td className="gt5-acoes">
                  <button type="button" className="primary-button small" onClick={() => salvarEdicao(l)}>Salvar</button>
                  <button type="button" className="ghost-button small" onClick={() => setEditandoId(null)}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={l.id}>
                <td><strong>{l.nome}</strong></td>
                <td>{l.polo_nome || 'Sem polo'}</td>
                <td>{[l.email, l.telefone].filter(Boolean).join(' · ') || '—'}</td>
                <td className="gt5-acoes">
                  <button type="button" className="ghost-button small" onClick={() => {
                    setEditandoId(l.id);
                    setRascunho({ nome: l.nome, polo_id: l.polo_id || '', email: l.email || '', telefone: l.telefone || '' });
                  }}>Editar</button>
                  <button type="button" className="ghost-button small danger" onClick={() => excluir(l)}>Excluir</button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
      {liderancas && liderancas.length === 0 && <p className="gt5-vazio">Nenhuma liderança cadastrada.</p>}
    </section>
  );
}
