import { Fragment, useEffect, useState } from 'react';
import { buscarEstadoIa, perguntarTutor } from '../../services/ia';
import { errorText } from '../manage/shared';

const MASCOTE = '/brand/atlas-mascote.gif';

// Formata **negrito** e quebras de linha. O texto vira nós de React (sem HTML), então nada é executado.
function textoComNegrito(linha, chave) {
  return linha.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? <strong key={`${chave}-${i}`}>{parte}</strong> : <Fragment key={`${chave}-${i}`}>{parte}</Fragment>
  );
}

// Respostas da IA chegam com listas (* item) e negrito. Monta parágrafos e listas, sem HTML cru.
function renderizarResposta(texto) {
  const blocos = [];
  let lista = null;
  let paragrafo = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push(<p key={`p-${blocos.length}`}>{paragrafo.map((l, i) => (
        <Fragment key={i}>{i > 0 && <br />}{textoComNegrito(l, `${blocos.length}-${i}`)}</Fragment>
      ))}</p>);
      paragrafo = [];
    }
  };
  const fecharLista = () => {
    if (lista) {
      blocos.push(<ul key={`ul-${blocos.length}`}>{lista.map((item, i) => <li key={i}>{textoComNegrito(item, `li-${blocos.length}-${i}`)}</li>)}</ul>);
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
  const [perguntaEnviada, setPerguntaEnviada] = useState('');
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    buscarEstadoIa()
      .then((estado) => ativo && setDisponivel(Boolean(estado?.modulos?.tutor)))
      .catch(() => ativo && setDisponivel(false));
    return () => {
      ativo = false;
    };
  }, []);

  if (!disponivel) return null;

  async function enviar(evento) {
    evento.preventDefault();
    if (!pergunta.trim() || enviando) return;
    const texto = pergunta.trim();
    setEnviando(true);
    setErro('');
    setResposta('');
    setPerguntaEnviada(texto);
    setPergunta('');
    try {
      setResposta(await perguntarTutor({ pergunta: texto, aulaId: lesson.id }));
    } catch (error) {
      setErro(errorText(error, 'O assistente não respondeu agora. Tente de novo.'));
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
        <button type="button" className="tutor-ia-fechar" onClick={() => setAberto(false)} aria-label="Fechar o Atlas">
          ×
        </button>
      </header>

      <form onSubmit={enviar}>
        <label htmlFor={`tutor-ia-${lesson?.id}`}>Sua dúvida</label>
        <textarea
          id={`tutor-ia-${lesson?.id}`}
          rows={3}
          maxLength={2000}
          value={pergunta}
          placeholder="Escreva sua pergunta sobre a aula…"
          onChange={(e) => setPergunta(e.target.value)}
        />
        <div className="tutor-ia-acoes">
          <button type="submit" className="primary-button small" disabled={enviando || !pergunta.trim()}>
            {enviando ? 'Pensando…' : 'Perguntar'}
          </button>
        </div>
      </form>

      {perguntaEnviada && (
        <div className="tutor-ia-balao-pergunta">{perguntaEnviada}</div>
      )}

      {enviando && (
        <div className="tutor-ia-digitando" role="status" aria-live="polite">
          <span /><span /><span />
          <small>O Atlas está pensando</small>
        </div>
      )}

      {erro && <div className="alert error manage-feedback" role="status">{erro}</div>}

      {resposta && (
        <div className="tutor-ia-balao-resposta">
          <img src={MASCOTE} alt="" className="tutor-ia-mascote pequeno" width="56" height="37" />
          <div className="tutor-ia-resposta">{renderizarResposta(resposta)}</div>
        </div>
      )}
    </div>
  );
}
