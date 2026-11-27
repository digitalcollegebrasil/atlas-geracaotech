import { useEffect, useState } from 'react';
import { listarPolos, criarPolo, atualizarPolo, excluirPolo } from '../../services/gt5';
import { errorText } from '../manage/shared';

// Polos são locais presenciais do interior. Excluir só sem nenhum uso; senão, desative.
export default function PolosTab({ onFeedback }) {
  const [polos, setPolos] = useState(null);
  const [nome, setNome] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState({ nome: '', ativa: true });

  const carregar = () => listarPolos().then((dados) => setPolos(dados.polos));

  useEffect(() => {
    carregar().catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function incluir(event) {
    event.preventDefault();
    try {
      await criarPolo({ nome });
      setNome('');
      onFeedback({ type: 'success', text: 'Polo incluído.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function salvarEdicao(polo) {
    try {
      await atualizarPolo(polo.id, { nome: rascunho.nome, ativa: rascunho.ativa });
      setEditandoId(null);
      onFeedback({ type: 'success', text: 'Polo atualizado.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  async function excluir(polo) {
    if (!window.confirm(`Excluir o polo "${polo.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await excluirPolo(polo.id);
      onFeedback({ type: 'success', text: 'Polo excluído.' });
      carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    }
  }

  if (!polos) return <p className="gt5-vazio">Carregando polos…</p>;

  return (
    <section className="gt5-secao">
      <form className="gt5-card" onSubmit={incluir}>
        <h2>Incluir polo</h2>
        <div className="gt5-acoes-grupo">
          <label className="gt5-campo gt5-campo-largo">
            <span>Nome do polo</span>
            <input placeholder="ex.: Sobral" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <button type="submit" className="primary-button small">Incluir polo</button>
        </div>
      </form>

      <div className="gt5-card">
        <h2>Polos cadastrados</h2>
        {polos.length === 0 ? <p className="gt5-vazio">Nenhum polo cadastrado.</p> : (
          <div className="table-wrap">
            <table className="manage-table">
              <thead>
                <tr>
                  <th>Polo</th>
                  <th>Situação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {polos.map((polo) => (editandoId === polo.id ? (
                  <tr key={polo.id} className="gt5-edicao">
                    <td>
                      <label className="gt5-campo">
                        <span>Nome do polo</span>
                        <input value={rascunho.nome} maxLength={120} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
                      </label>
                    </td>
                    <td>
                      <label className="checkbox-row">
                        <input type="checkbox" checked={rascunho.ativa} onChange={(e) => setRascunho({ ...rascunho, ativa: e.target.checked })} />
                        Polo ativo
                      </label>
                    </td>
                    <td className="gt5-acoes">
                      <button type="button" className="primary-button small" onClick={() => salvarEdicao(polo)}>Salvar</button>
                      <button type="button" className="ghost-button small" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={polo.id}>
                    <td>
                      <strong>{polo.nome}</strong>
                      <span className="gt5-id">{polo.cidade}/{polo.uf}</span>
                    </td>
                    <td><span className={`badge${polo.ativa ? '' : ' hidden'}`}>{polo.ativa ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="gt5-acoes">
                      <button type="button" className="ghost-button small" onClick={() => { setEditandoId(polo.id); setRascunho({ nome: polo.nome, ativa: polo.ativa }); }}>Editar</button>
                      <button type="button" className="danger-button small" onClick={() => excluir(polo)}>Excluir</button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
