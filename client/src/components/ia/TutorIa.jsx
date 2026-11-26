import { Fragment, useEffect, useRef, useState } from 'react';
import { buscarEstadoIa, perguntarTutor } from '../../services/ia';
import { errorText } from '../manage/shared';

const MASCOTE = '/brand/atlas-mascote.gif';
const TROCAS_NO_HISTORICO = 6; // últimas 6 perguntas e respostas são enviadas como contexto

// Negrito, itálico e `código` viram elementos de React (sem HTML cru).
function formatarLinha(linha, chave) {
  return linha.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((parte, i) => {
    const k = `${chave}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(parte)) return <strong key={k}>{parte.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(parte)) return <code key={k}>{parte.slice(1, -1)}</code>;
    if (/^\*[^*\s][^*]*\*$/.test(parte)) return <em key={k}>{parte.slice(1, -1)}</em>;
    return <Fragment key={k}>{parte}</Fragment>;
  });
}

// Respostas da IA chegam com parágrafos, listas (* item) e destaques. Monta blocos com classes próprias.
function renderizarResposta(texto) {
  const blocos = [];
  let lista = null;
  let paragrafo = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      const n = blocos.length;
      blocos.push(
        <p key={`p-${n}`}>
          {paragrafo.map((l, i) => (
            <Fragment key={i}>{i > 0 && <br />}{formatarLinha(l, `${n}-${i}`)}</Fragment>
          ))}
        </p>
      );
      paragrafo = [];
    }
  };
  const fecharLista = () => {
    if (lista) {
      const n = blocos.length;
      blocos.push(
        <ul key={`ul-${n}`}>
          {lista.map((item, i) => <li key={i}>{formatarLinha(item, `li-${n}-${i}`)}</li>)}
        </ul>
      );
      lista = null;
    }
  };

  for (const bruta of String(texto || '').split('\n')) {
    const linha = bruta.trim();
    const item = linha.match(/^[*-]\s+(.*)$/);
    if (!linha) {
      fecharParagrafo();
      fecharLista();
    } else if (item) {
      fecharParagrafo();
      (lista ||= []).push(item[1]);
    } else {
      fecharLista();
      paragrafo.push(linha);
    }
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

// Só aparece quando a IA está ligada e configurada, e o módulo tutor está ativo.
export default function TutorIa({ lesson }) {
  const [disponivel, setDisponivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState('');
  // Conversa da aula: [{ papel: 'aluno' | 'atlas', texto }]. Fica só na tela; não é gravada.
  const [conversa, setConversa] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef(null);

  useEffect(() => {
    let ativo = true;
    buscarEstadoIa()
      .then((estado) => ativo && setDisponivel(Boolean(estado?.modulos?.tutor)))
      .catch(() => ativo && setDisponivel(false));
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [conversa, enviando, aberto]);

  if (!disponivel) return null;

  async function enviar(evento) {
    evento.preventDefault();
    if (!pergunta.trim() || enviando) return;
    const texto = pergunta.trim();
    // Histórico em formato de API: só trocas concluídas (sem a pergunta atual, que vai à parte).
    const historico = conversa
      .slice(-TROCAS_NO_HISTORICO * 2)
      .map((m) => ({ role: m.papel === 'aluno' ? 'user' : 'assistant', content: m.texto }));

    setEnviando(true);
    setErro('');
    setPergunta('');
    setConversa((atual) => [...atual, { papel: 'aluno', texto }]);

    const falhar = (mensagem) => {
      setConversa((atual) => atual.slice(0, -1)); // a pergunta que falhou volta para o campo
      setPergunta(texto);
      setErro(mensagem);
    };

    try {
      const resp = await perguntarTutor({ pergunta: texto, aulaId: lesson.id, historico });
      if (resp && resp.trim()) {
        setConversa((atual) => [...atual, { papel: 'atlas', texto: resp }]);
      } else {
        falhar('O Atlas não conseguiu responder desta vez. Tente reformular a pergunta.');
      }
    } catch (error) {
      falhar(errorText(error, 'O assistente não respondeu agora. Tente de novo.'));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="tutor-ia">
        <button type="button" className="tutor-ia-convite" onClick={() => setAberto(true)}>
          <img src={MASCOTE} alt="" className="tutor-ia-mascote" width="96" height="64" />
          <span className="tutor-ia-texto">
            <strong>Atlas</strong>
            <small>Tutor de IA do Geração Tech</small>
          </span>
          <span className="tutor-ia-chamada">Tirar dúvida com o Atlas</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tutor-ia is-open">
      <header className="tutor-ia-cabecalho">
        <img src={MASCOTE} alt="" className="tutor-ia-mascote pequeno" width="56" height="37" />
        <span className="tutor-ia-texto">
          <strong>Atlas</strong>
          <small>Tire sua dúvida sobre esta aula</small>
        </span>
        {conversa.length > 0 && (
          <button type="button" className="tutor-ia-novo" onClick={() => setConversa([])} disabled={enviando}>
            Nova conversa
          </button>
        )}
        <button type="button" className="tutor-ia-fechar" onClick={() => setAberto(false)} aria-label="Fechar o Atlas">
          ×
        </button>
      </header>

      {conversa.length > 0 && (
        <div className="tutor-ia-conversa">
          {conversa.map((m, i) =>
            m.papel === 'aluno' ? (
              <div key={i} className="tutor-ia-balao-pergunta">{m.texto}</div>
            ) : (
              <div key={i} className="tutor-ia-balao-resposta">
                <img src={MASCOTE} alt="" className="tutor-ia-mascote pequeno" width="56" height="37" />
                <div className="tutor-ia-resposta">{renderizarResposta(m.texto)}</div>
              </div>
            )
          )}
          {enviando && (
            <div className="tutor-ia-digitando" role="status" aria-live="polite">
              <span /><span /><span />
              <small>O Atlas está pensando</small>
            </div>
          )}
          <div ref={fimRef} />
        </div>
      )}

      {erro && <div className="alert error manage-feedback" role="status">{erro}</div>}

      <form onSubmit={enviar} className="tutor-ia-form">
        <label htmlFor={`tutor-ia-${lesson?.id}`}>{conversa.length ? 'Continue a conversa' : 'Sua dúvida'}</label>
        <textarea
          id={`tutor-ia-${lesson?.id}`}
          rows={2}
          maxLength={2000}
          value={pergunta}
          placeholder="Escreva sua pergunta sobre a aula…"
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="tutor-ia-acoes">
          <button type="submit" className="primary-button small" disabled={enviando || !pergunta.trim()}>
            {enviando ? 'Pensando…' : 'Perguntar'}
          </button>
        </div>
      </form>
    </div>
  );
}
