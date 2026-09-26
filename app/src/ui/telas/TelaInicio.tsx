// Início — resumo do mês (completo na etapa 4).
import { APP } from '../../app.config';
import { irPara } from '../rotas';
import { IconeEtiqueta } from '../icones';

const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function TelaInicio() {
  return (
    <>
      <header class="cabecalho">
        <h1>{APP.nome}</h1>
        <span class="sub">{fmtDataLonga.format(new Date())}</span>
      </header>
      <div class="conteudo">
        <section class="cartao">
          <h2>
            <IconeEtiqueta /> Primeiros passos
          </h2>
          <p class="dica">O resumo do mês aparece aqui. Comece pelos cadastros: categorias, meios de pagamento e pessoas.</p>
          <button class="link" onClick={() => irPara('cadastros')}>
            Ir para Cadastros →
          </button>
        </section>
      </div>
    </>
  );
}
