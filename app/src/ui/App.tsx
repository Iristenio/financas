import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { irPara, telaPermitida, useTela, type Tela } from './rotas';
import { MenuLateral } from './layout/MenuLateral';
import { PainelLateral } from './layout/PainelLateral';
import { BotaoNovo, type OpcaoNovo } from './layout/BotaoNovo';
import { AvisoAtualizacao } from './layout/AvisoAtualizacao';
import { AvisoDesfazer } from './componentes/AvisoDesfazer';
import { Dialogo } from './componentes/Dialogo';
import { ProvedorEstado, useEstado, type Painel } from './estado';
import { usePerfil } from './perfil';
import { TelaInicio } from './telas/TelaInicio';
import { TelaAjustes } from './telas/TelaAjustes';
import { lerAbaCadastro, TelaCadastros } from './telas/TelaCadastros';
import { FormCategoria, FormFonte, FormMeio, FormPessoa } from './paineis/FormCadastros';
import { FormNovaConta } from './paineis/FormNovaConta';
import { DetalheConta } from './paineis/DetalheConta';
import { TelaLancamentos } from './telas/TelaLancamentos';
import { TelaPagar } from './telas/TelaPagar';
import { TelaMonitoramento } from './telas/TelaMonitoramento';
import { TelaRecorrentes } from './telas/TelaRecorrentes';
import { IconeEtiqueta, IconeLista } from './icones';

function EmBreve({ titulo, etapa }: { titulo: string; etapa: number }) {
  return (
    <>
      <header class="cabecalho">
        <h1>{titulo}</h1>
      </header>
      <div class="conteudo">
        <div class="vazio grande">
          <IconeEtiqueta />
          <strong>Em construção</strong>
          Esta tela chega na etapa {etapa} do plano.
        </div>
      </div>
    </>
  );
}

/** ► Nova tela: acrescente aqui (e em TELAS/MENU, em rotas.ts). */
const TELA: Record<Tela, () => JSX.Element> = {
  inicio: () => <TelaInicio />,
  lancamentos: TelaLancamentos,
  pagar: TelaPagar,
  monitoramento: TelaMonitoramento,
  recorrentes: TelaRecorrentes,
  gastos: () => <EmBreve titulo="Gastos" etapa={5} />,
  carteira: () => <EmBreve titulo="Carteira" etapa={5} />,
  cadastros: TelaCadastros,
  config: TelaAjustes,
};

/** ► Novo painel: título e conteúdo de cada tipo declarado em estado.tsx. */
function tituloPainel(p: Painel): string {
  switch (p.tipo) {
    case 'categoria':
      return p.id ? 'Categoria' : 'Nova categoria';
    case 'meio':
      return p.id ? 'Meio de pagamento' : 'Novo meio de pagamento';
    case 'pessoa':
      return p.id ? 'Pessoa' : 'Nova pessoa';
    case 'fonte':
      return p.id ? 'Fonte' : 'Nova fonte';
    case 'nova-conta':
      return 'Nova conta';
    case 'conta':
      return p.modo === 'editar' ? 'Editar conta' : p.modo === 'ajustar' ? 'Ajustar valor' : p.modo === 'antecipar' ? 'Antecipar parcelas' : 'Conta';
    case 'gasto':
      return p.id ? 'Gasto' : 'Novo gasto';
    case 'entrada':
      return p.id ? 'Entrada' : 'Nova entrada';
  }
}

function ConteudoPainel({ painel }: { painel: Painel }) {
  switch (painel.tipo) {
    case 'categoria':
      return <FormCategoria id={painel.id} />;
    case 'meio':
      return <FormMeio id={painel.id} />;
    case 'pessoa':
      return <FormPessoa id={painel.id} />;
    case 'fonte':
      return <FormFonte id={painel.id} />;
    case 'nova-conta':
      return <FormNovaConta />;
    case 'conta':
      return <DetalheConta key={`${painel.id}-${painel.modo ?? 'ver'}`} id={painel.id} modo={painel.modo} />;
    default:
      return <p class="dica">Em construção.</p>;
  }
}

function Estrutura() {
  const tela = useTela();
  const { ehAdmin } = usePerfil();
  const { painel, abrirPainel, fecharPainel } = useEstado();
  const permitida = telaPermitida(tela, ehAdmin);
  const Conteudo = TELA[permitida ? tela : 'lancamentos'];

  useEffect(() => {
    if (!permitida) irPara('lancamentos');
  }, [permitida]);

  /** Opções do botão "+" em cada tela (com uma só, ele cria direto). */
  const novaConta: OpcaoNovo = { rotulo: 'Nova conta', Icone: IconeLista, acao: () => abrirPainel({ tipo: 'nova-conta' }) };
  const opcoesNovo: OpcaoNovo[] =
    tela === 'inicio' || tela === 'lancamentos' || tela === 'pagar' || tela === 'monitoramento' || tela === 'recorrentes'
      ? [novaConta]
      : tela === 'cadastros'
      ? [
          {
            rotulo: 'Novo cadastro',
            Icone: IconeEtiqueta,
            acao: () => {
              const aba = lerAbaCadastro();
              abrirPainel({ tipo: aba === 'categorias' ? 'categoria' : aba === 'meios' ? 'meio' : 'pessoa' });
            },
          },
        ]
      : [];

  return (
    <div class="estrutura">
      <MenuLateral atual={tela} />
      <main class="principal">
        <Conteudo />
        {tela !== 'config' && <BotaoNovo opcoes={opcoesNovo} />}
      </main>
      {painel && (
        <PainelLateral titulo={tituloPainel(painel)} aoFechar={fecharPainel}>
          <ConteudoPainel painel={painel} />
        </PainelLateral>
      )}
      <AvisoDesfazer />
      <AvisoAtualizacao />
      <Dialogo />
    </div>
  );
}

export function App() {
  return (
    <ProvedorEstado>
      <Estrutura />
    </ProvedorEstado>
  );
}
