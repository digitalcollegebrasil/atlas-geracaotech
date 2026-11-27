import { formatarDataHora } from './gt5Format';

// Data da última sincronização, por fonte: planilha da gestão e integração com o site do GT.
export default function UltimaSincronizacao({ sincronizacoes }) {
  return (
    <p className="gt5-sync">
      Última sincronização: planilha, {formatarDataHora(sincronizacoes?.planilha?.sincronizado_em)};
      {' '}site do GT, {formatarDataHora(sincronizacoes?.integracao?.sincronizado_em)}.
    </p>
  );
}
