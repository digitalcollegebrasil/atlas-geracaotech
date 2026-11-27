import Sidebar from '../components/Sidebar';
import IaAdminSwitch from '../components/ia/IaAdminSwitch';
import TutorAparencia from '../components/ia/TutorAparencia';

// Administração da IA: liga ou desliga o assistente e define a aparência do tutor. Só o admin acessa esta tela.
export default function IaAdminPage() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <section className="section-heading">
          <h1>Inteligência artificial</h1>
          <p>Liga ou desliga o assistente das aulas e define como o tutor aparece para os alunos.</p>
        </section>
        <h2 className="ia-admin-titulo">Assistente</h2>
        <IaAdminSwitch />
        <h2 className="ia-admin-titulo">Aparência do tutor</h2>
        <TutorAparencia />
      </div>
    </div>
  );
}
