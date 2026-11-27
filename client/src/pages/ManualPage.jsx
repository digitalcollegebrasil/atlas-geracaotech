import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import '../styles/manual.css';

// Manual do Atlas para a monitoria: como os alunos usam cada parte, em perguntas e respostas.
const SECOES = [
  {
    titulo: 'Primeiros passos',
    perguntas: [
      {
        p: 'Como o aluno entra pela primeira vez?',
        r: 'O CPF é o login e também a senha do primeiro acesso. No primeiro acesso o sistema pede que a senha seja trocada.',
        links: [{ to: '/minha-area', label: 'Minha área (trocar senha)' }]
      },
      {
        p: 'Como trocar a senha depois?',
        r: 'Em Minha área, na seção Trocar senha: informe a senha atual, a nova senha e confirme. Use o ícone de olho para conferir o que está digitando.',
        links: [{ to: '/minha-area', label: 'Minha área' }]
      },
      {
        p: 'O menu lateral some ou fica pequeno. O que fazer?',
        r: 'Use a setinha no topo do menu "Seu espaço" para recolher ou abrir o menu. As páginas se ajustam às duas opções.'
      },
      {
        p: 'Como usar o modo escuro?',
        r: 'Use o botão Dark mode no topo da página. A escolha fica salva no navegador.'
      }
    ]
  },
  {
    titulo: 'Cursos e progresso',
    perguntas: [
      {
        p: 'Onde o aluno encontra os cursos?',
        r: 'Em Trilhas (Cursos). Cada curso mostra o nível, o progresso em porcentagem e a estimativa de horas. O botão Ver curso abre o conteúdo.',
        links: [{ to: '/cursos', label: 'Cursos' }]
      },
    ]
  },
  {
    titulo: 'Mural',
    perguntas: [
      {
        p: 'Para que serve o Mural?',
        r: 'É onde a equipe publica avisos e tópicos de fórum. Os alunos leem, respondem e acompanham os recados da turma.',
        links: [{ to: '/mural', label: 'Mural' }]
      }
    ]
  },
  {
    titulo: 'Codice (sala de código)',
    perguntas: [
      {
        p: 'Como o aluno cria uma sala de código?',
        r: 'Em Editor, escreva seu nome e clique em Criar nova sala. A sala abre com um código que você pode passar para a turma.',
        links: [{ to: '/editor', label: 'Codice (Editor)' }]
      },
      {
        p: 'Como entrar na sala de um colega?',
        r: 'Em Editor, digite o código da sala no campo Entrar em uma sala e clique em Entrar. Todos escrevem no mesmo projeto.'
      },
      {
        p: 'E se o código de programação não rodar?',
        r: 'Confirme se o aluno está na sala certa e se o código está salvo. Quando a dúvida é técnica, encaminhe para a monitoria pelo chat Atendimento técnico.'
      }
    ]
  },
  {
    titulo: 'Codey (jogo de programação)',
    perguntas: [
      {
        p: 'O que é o Codey?',
        r: 'Um jogo de programação em que o aluno treina código resolvendo desafios, sem instalar nada.',
        links: [{ to: '/jogo', label: 'Codey' }]
      }
    ]
  },
  {
    titulo: 'Anotações e documentos',
    perguntas: [
      {
        p: 'Para que servem as Anotações?',
        r: 'São um bloco de notas pessoal do aluno, para registrar o que aprendeu nas aulas.',
        links: [{ to: '/anotacoes', label: 'Anotações' }]
      },
      {
        p: 'Onde ficam os certificados e documentos?',
        r: 'Em Documentos. Quando um documento estiver disponível, ele aparece nessa tela.',
        links: [{ to: '/documentos', label: 'Documentos' }]
      }
    ]
  },
  {
    titulo: 'Presença e cronogramas',
    perguntas: [
      {
        p: 'Como o aluno acompanha a presença?',
        r: 'Em Minha presença ele vê as presenças e faltas registradas.',
        links: [{ to: '/presenca', label: 'Minha presença' }]
      },
      {
        p: 'Onde ficam as datas das aulas?',
        r: 'Em Cronogramas.',
        links: [{ to: '/cronogramas', label: 'Cronogramas' }]
      }
    ]
  },
  {
    titulo: 'Atendimento e monitoria',
    perguntas: [
      {
        p: 'Como funciona o Atendimento?',
        r: 'O assistente virtual responde às perguntas mais comuns. Escolha um assunto pronto ou escreva a dúvida. Se precisar de uma pessoa, use Falar com a equipe.',
        links: [{ to: '/atendimento', label: 'Atendimento' }]
      },
      {
        p: 'Qual o horário de atendimento da equipe?',
        r: 'De segunda a sexta, das 9h às 17h.'
      },
      {
        p: 'Quando a dúvida é técnica, o que o aluno faz?',
        r: 'Escolha a aba Dúvidas técnicas no Atendimento. A conversa vai para a monitoria, que responde sobre aulas, código e a plataforma.',
        links: [{ to: '/atendimento', label: 'Atendimento (Dúvidas técnicas)' }]
      }
    ]
  },
  {
    titulo: 'Perfil',
    perguntas: [
      {
        p: 'Onde o aluno atualiza os dados do perfil?',
        r: 'Em Meu perfil, dentro de Minha área.',
        links: [{ to: '/minha-area', label: 'Meu perfil' }]
      }
    ]
  }
];

export default function ManualPage() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content manual">
        <section className="atend-head">
          <div>
            <span className="eyebrow">Monitoria</span>
            <h1>Manual do Atlas</h1>
            <p>Como os alunos podem e devem usar o Atlas, de cima a baixo. Abra cada pergunta para ver a resposta e o link da tela.</p>
          </div>
        </section>

        {SECOES.map((secao) => (
          <section key={secao.titulo} className="surface-card manual-secao">
            <h2>{secao.titulo}</h2>
            {secao.perguntas.map((item) => (
              <details key={item.p} className="manual-pergunta">
                <summary>{item.p}</summary>
                <p>{item.r}</p>
                {item.links?.length > 0 && (
                  <p className="manual-links">
                    {item.links.map((link) => (
                      <Link key={link.to} to={link.to} className="text-link">{link.label}</Link>
                    ))}
                  </p>
                )}
              </details>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
