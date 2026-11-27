import { useEffect, useState } from 'react';
import api from '../../services/api';
import { buscarAparenciaTutor, salvarAparenciaTutor } from '../../services/ia';
import { Feedback, errorText } from '../manage/shared';
import { FONTES } from '../../utils/aparencia.js';
import { FORMATOS_TUTOR, APARENCIA_TUTOR_PADRAO, MASCOTE_PADRAO, estiloTutor } from './tutorTema.js';

const TIPOS_IMAGEM = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];
const LIMITE_IMAGEM = 5 * 1024 * 1024;

// Aparência do tutor: nome, imagem ou gif, cores, fonte e formato, com prévia ao lado.
export default function TutorAparencia() {
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    buscarAparenciaTutor()
      .then(setRascunho)
      .catch((error) => setFeedback({ type: 'error', text: errorText(error) }));
  }, []);

  function mudar(campo, valor) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviarImagem(arquivo) {
    if (!arquivo) return;
    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      setFeedback({ type: 'error', text: 'Use uma imagem GIF, PNG, JPG ou WebP.' });
      return;
    }
    if (arquivo.size > LIMITE_IMAGEM) {
      setFeedback({ type: 'error', text: 'A imagem deve ter até 5 MB.' });
      return;
    }
    setEnviandoImagem(true);
    setFeedback(null);
    try {
      const { data } = await api.post('/media', arquivo, { headers: { 'Content-Type': arquivo.type } });
      setRascunho((atual) => ({ ...atual, mascoteCaminho: data.path, mascote: data.url }));
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function salvar(event) {
    event.preventDefault();
    setSalvando(true);
    setFeedback(null);
    try {
      const salvo = await salvarAparenciaTutor({
        nome: rascunho.nome,
        mascoteCaminho: rascunho.mascoteCaminho,
        corFundo: rascunho.corFundo,
        corDestaque: rascunho.corDestaque,
        fonte: rascunho.fonte,
        formato: rascunho.formato,
      });
      setRascunho(salvo);
      setFeedback({ type: 'success', text: 'Aparência do tutor salva.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  if (!rascunho) {
    return <section className="surface-card ia-admin-card"><Feedback feedback={feedback} />{!feedback && <p>Carregando…</p>}</section>;
  }

  const mascote = rascunho.mascote || MASCOTE_PADRAO;

  return (
    <div className="tutor-aparencia">
      <form className="surface-card ia-admin-card" onSubmit={salvar}>
        <label>
          Nome do tutor
          <input value={rascunho.nome} onChange={(e) => mudar('nome', e.target.value)} maxLength={40} />
        </label>

        <div className="tutor-aparencia-imagem">
          <img src={mascote} alt="" width="64" height="64" />
          <div className="editor-actions">
            <label className="ghost-button small">
              {enviandoImagem ? 'Enviando…' : 'Trocar imagem ou gif'}
              <input
                type="file"
                accept="image/gif,image/png,image/jpeg,image/webp"
                hidden
                disabled={enviandoImagem}
                onChange={(e) => enviarImagem(e.target.files?.[0])}
              />
            </label>
            {rascunho.mascoteCaminho && (
              <button type="button" className="ghost-button small" onClick={() => setRascunho((a) => ({ ...a, mascoteCaminho: null, mascote: null }))}>
                Usar imagem padrão
              </button>
            )}
          </div>
        </div>

        <div className="form-grid">
          <label>
            Cor de fundo
            <input type="color" value={rascunho.corFundo} onChange={(e) => mudar('corFundo', e.target.value)} />
          </label>
          <label>
            Cor de destaque
            <input type="color" value={rascunho.corDestaque} onChange={(e) => mudar('corDestaque', e.target.value)} />
          </label>
          <label>
            Fonte
            <select value={rascunho.fonte} onChange={(e) => mudar('fonte', e.target.value)}>
              {Object.entries(FONTES).map(([id, fonte]) => (
                <option key={id} value={id}>{fonte.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Formato dos cards
            <select value={rascunho.formato} onChange={(e) => mudar('formato', e.target.value)}>
              {Object.entries(FORMATOS_TUTOR).map(([id, formato]) => (
                <option key={id} value={id}>{formato.nome}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="editor-actions">
          <button type="submit" className="primary-button small" disabled={salvando || enviandoImagem}>
            {salvando ? 'Salvando…' : 'Salvar aparência'}
          </button>
          <button type="button" className="ghost-button small" onClick={() => setRascunho({ ...APARENCIA_TUTOR_PADRAO, mascote: null })}>
            Restaurar padrão
          </button>
        </div>
        <Feedback feedback={feedback} />
      </form>

      <aside className="tutor-ia tutor-aparencia-previa" style={estiloTutor(rascunho)} aria-label="Prévia do tutor">
        <p className="tutor-aparencia-legenda">Prévia de como o tutor aparece para o aluno</p>
        <div className="tutor-ia-convite" role="presentation">
          <img src={mascote} alt="" className="tutor-ia-mascote" width="96" height="64" />
          <span className="tutor-ia-texto">
            <strong>{rascunho.nome || 'Atlas'}</strong>
            <small>Tutor de IA do Geração Tech</small>
          </span>
          <span className="tutor-ia-chamada">Tirar dúvida</span>
        </div>
      </aside>
    </div>
  );
}
