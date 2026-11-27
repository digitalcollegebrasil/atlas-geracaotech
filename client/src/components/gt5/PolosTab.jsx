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
      <form className="gt5-linha-form" onSubmit={incluir}>
        <input
          aria-label="Nome do novo polo"
          placeholder="Nome do polo, ex.: Sobral"
          value={nome}
          maxLength={120}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <button type="submit" className="primary-button small">Incluir polo</button>
      </form>

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
            <tr key={polo.id}>
              <td>
                <input
                  aria-label="Nome do polo"
                  value={rascunho.nome}
                  maxLength={120}
                  onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                />
              </td>
              <td>
                <label>
                  <input
                    type="checkbox"
                    checked={rascunho.ativa}
                    onChange={(e) => setRascunho({ ...rascunho, ativa: e.target.checked })}
                  />
                  {' '}Ativo
                </label>
              </td>
              <td className="gt5-acoes">
                <button type="button" className="primary-button small" onClick={() => salvarEdicao(polo)}>Salvar</button>
                <button type="button" className="ghost-button small" onClick={() => setEditandoId(null)}>Cancelar</button>
              </td>
            </tr>
          ) : (
            <tr key={polo.id}>
              <td><strong>{polo.nome}</strong> <span className="gt5-ajuda">{polo.cidade}/{polo.uf}</span></td>
              <td>{polo.ativa ? 'Ativo' : 'Inativo'}</td>
              <td className="gt5-acoes">
                <button type="button" className="ghost-button small" onClick={() => { setEditandoId(polo.id); setRascunho({ nome: polo.nome, ativa: polo.ativa }); }}>Editar</button>
                <button type="button" className="ghost-button small danger" onClick={() => excluir(polo)}>Excluir</button>
              </td>
            </tr>
          )))}
        </tbody>
      </table>
      {polos.length === 0 && <p className="gt5-vazio">Nenhum polo cadastrado.</p>}
    </section>
  );
}
