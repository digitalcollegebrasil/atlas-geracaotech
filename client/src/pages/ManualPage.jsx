import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Feedback, errorText } from '../components/manage/shared';
import '../styles/manual.css';

// Manual do Atlas: perguntas e respostas com links. A administração pode editar tudo por aqui.
const novoId = () => Math.random().toString(36).slice(2, 10);
const copia = (valor) => JSON.parse(JSON.stringify(valor));

export default function ManualPage() {
  const { isAdmin } = useAuth();
  const [secoes, setSecoes] = useState(null);
  const [rascunho, setRascunho] = useState(null); // preenchido só durante a edição
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    api.get('/manual')
      .then(({ data }) => setSecoes(data.secoes))
      .catch((error) => setFeedback({ type: 'error', text: errorText(error) }));
  }, []);

  const editando = rascunho !== null;
  const mudar = (fn) => setRascunho((atual) => fn(copia(atual)));

  const iniciarEdicao = () => {
    setFeedback(null);
    setRascunho(copia(secoes));
  };

  const cancelar = () => {
    setRascunho(null);
    setFeedback(null);
  };

  const salvar = async () => {
    setSalvando(true);
    setFeedback(null);
    try {
      const { data } = await api.put('/manual', { secoes: rascunho });
      setSecoes(data.secoes);
      setRascunho(null);
      setFeedback({ type: 'success', text: 'Manual salvo. Ele já aparece com a versão nova.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  };

  // ── Edição ──────────────────────────────────────────────────────────
  const editarSecao = (i, campo, valor) => mudar((m) => { m[i][campo] = valor; return m; });
  const removerSecao = (i) => mudar((m) => { m.splice(i, 1); return m; });
  const adicionarSecao = () => mudar((m) => [...m, { id: novoId(), titulo: 'Nova seção', perguntas: [] }]);

  const editarPergunta = (i, j, campo, valor) => mudar((m) => { m[i].perguntas[j][campo] = valor; return m; });
  const removerPergunta = (i, j) => mudar((m) => { m[i].perguntas.splice(j, 1); return m; });
  const adicionarPergunta = (i) => mudar((m) => {
    m[i].perguntas.push({ id: novoId(), p: 'Nova pergunta', r: 'Resposta.', links: [] });
    return m;
  });

  const editarLink = (i, j, k, campo, valor) => mudar((m) => { m[i].perguntas[j].links[k][campo] = valor; return m; });
  const removerLink = (i, j, k) => mudar((m) => { m[i].perguntas[j].links.splice(k, 1); return m; });
  const adicionarLink = (i, j) => mudar((m) => {
    m[i].perguntas[j].links.push({ label: 'Abrir tela', to: '/' });
    return m;
  });

  if (!secoes && !feedback) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-content manual"><p className="muted">Carregando manual…</p></div>
      </div>
    );
  }

  const lista = editando ? rascunho : secoes || [];

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content manual">
        <section className="atend-head">
          <div>
            <span className="eyebrow">Manual</span>
            <h1>Manual do Atlas</h1>
            <p>Como os alunos podem e devem usar o Atlas, de cima a baixo. Abra cada pergunta para ver a resposta e o link da tela.</p>
          </div>
          {isAdmin && !editando && (
            <button type="button" className="primary-button small" onClick={iniciarEdicao}>Editar manual</button>
          )}
          {isAdmin && editando && (
            <div className="manual-acoes">
              <button type="button" className="ghost-button small" onClick={cancelar} disabled={salvando}>Cancelar</button>
              <button type="button" className="primary-button small" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar manual'}
              </button>
            </div>
          )}
        </section>

        <Feedback feedback={feedback} />

        {!editando && lista.map((secao) => (
          <section key={secao.id} className="surface-card manual-secao">
            <h2>{secao.titulo}</h2>
            {secao.perguntas.map((item) => (
              <details key={item.id} className="manual-pergunta">
                <summary>{item.p}</summary>
                <p>{item.r}</p>
                {item.links.length > 0 && (
                  <p className="manual-links">
                    {item.links.map((link) => (
                      <Link key={`${link.to}-${link.label}`} to={link.to} className="text-link">{link.label}</Link>
                    ))}
                  </p>
                )}
              </details>
            ))}
          </section>
        ))}

        {editando && (
          <>
            {lista.map((secao, i) => (
              <section key={secao.id} className="surface-card manual-secao manual-edicao">
                <div className="manual-linha">
                  <label className="manual-campo">
                    <span>Título da seção</span>
                    <input value={secao.titulo} onChange={(e) => editarSecao(i, 'titulo', e.target.value)} maxLength={80} />
                  </label>
                  <button type="button" className="danger-button small" onClick={() => removerSecao(i)}>Excluir seção</button>
                </div>

                {secao.perguntas.map((item, j) => (
                  <div key={item.id} className="manual-pergunta-edicao">
                    <label className="manual-campo">
                      <span>Pergunta</span>
                      <input value={item.p} onChange={(e) => editarPergunta(i, j, 'p', e.target.value)} maxLength={160} />
                    </label>
                    <label className="manual-campo">
                      <span>Resposta</span>
                      <textarea rows={3} value={item.r} onChange={(e) => editarPergunta(i, j, 'r', e.target.value)} maxLength={2000} />
                    </label>

                    <p className="muted">Links (aparecem embaixo da resposta; use caminhos do Atlas, como /cursos)</p>
                    {item.links.map((link, k) => (
                      <div key={k} className="manual-linha">
                        <input aria-label="Texto do link" value={link.label} maxLength={80} onChange={(e) => editarLink(i, j, k, 'label', e.target.value)} />
                        <input aria-label="Caminho do link" value={link.to} maxLength={200} onChange={(e) => editarLink(i, j, k, 'to', e.target.value)} />
                        <button type="button" className="ghost-button small" onClick={() => removerLink(i, j, k)}>Remover link</button>
                      </div>
                    ))}
                    <div className="manual-linha">
                      <button type="button" className="ghost-button small" onClick={() => adicionarLink(i, j)}>Adicionar link</button>
                      <button type="button" className="danger-button small" onClick={() => removerPergunta(i, j)}>Excluir pergunta</button>
                    </div>
                  </div>
                ))}

                <button type="button" className="ghost-button small" onClick={() => adicionarPergunta(i)}>Adicionar pergunta</button>
              </section>
            ))}
            <button type="button" className="primary-button small" onClick={adicionarSecao}>Adicionar seção</button>
          </>
        )}
      </div>
    </div>
  );
}
