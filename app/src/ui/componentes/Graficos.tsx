// Gráficos do Painel em SVG próprio (sem biblioteca externa — funciona offline).
// Medem a largura real do contêiner para desenhar em pixels (texto nunca fica esticado).
import type preact from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatarMesCurto } from '../../dominio/meses';

const ALTURA = 220;
const MARGEM = { topo: 22, direita: 8, base: 26, esquerda: 52 };

export function useLargura<T extends HTMLElement>(): [preact.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, largura];
}

/** Marcas "redondas" no eixo: 0, 1 mil, 2 mil… (passos de 1, 2 ou 5 × 10^n). */
function marcasEixo(maximo: number): number[] {
  if (maximo <= 0) return [0];
  const bruto = maximo / 4;
  const base = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * base).find((p) => p >= bruto)!;
  const topo = Math.ceil(maximo / passo) * passo;
  return Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
}

const fmtCompacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
/** "set"; janeiro com o ano ("jan/27") quando há espaço entre os rótulos. */
const rotuloMes = (m: string, comAno: boolean) => formatarMesCurto(m).split('/')[0] + (comAno && m.endsWith('-01') ? `/${m.slice(2, 4)}` : '');
const rotuloEixo = (v: number) => (v === 0 ? '0' : fmtCompacto.format(v));

/** Retângulo com cantos de 4px só em cima (a ponta do dado); a base fica reta. */
function barra(x: number, y: number, l: number, a: number, arredondar: boolean) {
  if (a <= 0) return '';
  const r = arredondar ? Math.min(4, l / 2, a) : 0;
  return `M${x},${y + a}V${y + r}Q${x},${y} ${x + r},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + a}Z`;
}

interface Comum {
  meses: string[];
  /** Índice do mês atual (separa realizado de previsto). */
  atual: number;
  selecionado: number;
  aoSelecionar: (i: number) => void;
  rotulo: string;
}

/** Eixos, faixa do "previsto", meses no rodapé e a camada que captura toque/mouse. */
function Moldura(props: Comum & { largura: number; marcas: number[]; y: (v: number) => number; children: preact.ComponentChildren }) {
  const { meses, largura, marcas, y } = props;
  const areaL = largura - MARGEM.esquerda - MARGEM.direita;
  const fatia = areaL / meses.length;
  const x0 = MARGEM.esquerda;
  const cadaQuantos = fatia >= 34 ? 1 : fatia >= 17 ? 2 : 3;
  const escolher = (e: PointerEvent) => {
    const caixa = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.floor((e.clientX - caixa.left) / fatia);
    if (i >= 0 && i < meses.length && i !== props.selecionado) props.aoSelecionar(i);
  };
  return (
    <svg class="grafico" width={largura} height={ALTURA} role="img" aria-label={props.rotulo}>
      <rect class="grafico-previsto" x={x0 + props.atual * fatia} y={MARGEM.topo - 16} width={(meses.length - props.atual) * fatia} height={ALTURA - MARGEM.base - MARGEM.topo + 16} />
      <text class="grafico-faixa" x={x0 + props.atual * fatia - 6} y={MARGEM.topo - 5} text-anchor="end">
        realizado
      </text>
      <text class="grafico-faixa" x={x0 + props.atual * fatia + 6} y={MARGEM.topo - 5}>
        previsto
      </text>
      {marcas.map((m) => (
        <g key={m}>
          <line class="grafico-grade" x1={x0} x2={largura - MARGEM.direita} y1={y(m)} y2={y(m)} />
          <text class="grafico-eixo" x={x0 - 6} y={y(m) + 4} text-anchor="end">
            {rotuloEixo(m)}
          </text>
        </g>
      ))}
      <rect class="grafico-selecao" x={x0 + props.selecionado * fatia} y={MARGEM.topo} width={fatia} height={ALTURA - MARGEM.base - MARGEM.topo} />
      {props.children}
      {meses.map((m, i) =>
        i % cadaQuantos === (props.atual % cadaQuantos) ? (
          <text key={m} class={`grafico-eixo${i === props.atual ? ' forte' : ''}`} x={x0 + (i + 0.5) * fatia} y={ALTURA - 8} text-anchor="middle">
            {rotuloMes(m, fatia * cadaQuantos >= 44)}
          </text>
        ) : null,
      )}
      <rect class="grafico-toque" x={x0} y={0} width={areaL} height={ALTURA} onPointerMove={escolher} onPointerDown={escolher} />
    </svg>
  );
}

/** Colunas empilhadas: pago (embaixo) e em aberto (em cima), com 2px de folga entre as partes. */
export function GraficoBarras(props: Comum & { pago: number[]; aberto: number[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const totais = props.pago.map((p, i) => p + props.aberto[i]);
  const marcas = marcasEixo(Math.max(...totais, 0));
  const topo = marcas[marcas.length - 1] || 1;
  const altura = ALTURA - MARGEM.base - MARGEM.topo;
  const y = (v: number) => MARGEM.topo + altura - (v / topo) * altura;
  const fatia = (largura - MARGEM.esquerda - MARGEM.direita) / props.meses.length;
  const l = Math.max(3, Math.min(24, fatia - 3));
  return (
    <div ref={ref} class="grafico-caixa">
      {largura > 0 && (
        <Moldura {...props} largura={largura} marcas={marcas} y={y}>
          {props.meses.map((m, i) => {
            const x = MARGEM.esquerda + i * fatia + (fatia - l) / 2;
            const hPago = (props.pago[i] / topo) * altura;
            const hAberto = (props.aberto[i] / topo) * altura;
            const folga = hPago > 0 && hAberto > 0 ? 2 : 0;
            return (
              <g key={m}>
                <path class="serie-pago" d={barra(x, y(0) - hPago, l, hPago, hAberto === 0)} />
                <path class="serie-aberto" d={barra(x, y(0) - hPago - folga - hAberto, l, hAberto, true)} />
              </g>
            );
          })}
        </Moldura>
      )}
    </div>
  );
}

/** Linha do saldo devedor; a parte prevista fica mais clara. */
export function GraficoLinha(props: Comum & { valores: number[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const marcas = marcasEixo(Math.max(...props.valores, 0));
  const topo = marcas[marcas.length - 1] || 1;
  const altura = ALTURA - MARGEM.base - MARGEM.topo;
  const y = (v: number) => MARGEM.topo + altura - (v / topo) * altura;
  const fatia = (largura - MARGEM.esquerda - MARGEM.direita) / props.meses.length;
  const x = (i: number) => MARGEM.esquerda + (i + 0.5) * fatia;
  const caminho = (de: number, ate: number) => props.valores.slice(de, ate + 1).map((v, k) => `${k ? 'L' : 'M'}${x(de + k)},${y(v)}`).join('');
  const ultimo = props.valores.length - 1;
  const area = `${caminho(0, ultimo)}L${x(ultimo)},${y(0)}L${x(0)},${y(0)}Z`;
  const s = props.selecionado;
  return (
    <div ref={ref} class="grafico-caixa">
      {largura > 0 && (
        <Moldura {...props} largura={largura} marcas={marcas} y={y}>
          <path class="linha-area" d={area} />
          <path class="linha-serie" d={caminho(0, props.atual)} />
          <path class="linha-serie prevista" d={caminho(props.atual, ultimo)} />
          <line class="grafico-mira" x1={x(s)} x2={x(s)} y1={MARGEM.topo} y2={y(0)} />
          <circle class="linha-ponto" cx={x(s)} cy={y(props.valores[s])} r={5} />
        </Moldura>
      )}
    </div>
  );
}
