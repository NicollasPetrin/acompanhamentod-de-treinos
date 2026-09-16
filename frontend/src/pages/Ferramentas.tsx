import { useMemo, useState } from 'react';
import { Calculator, Repeat, Weight } from 'lucide-react';
import { useUnidade } from '../lib/auth';
import { ANILHAS_PADRAO, calcularAnilhas, estimar1RM, kgParaLb, lbParaKg } from '../lib/calculos';
import { formatarNumero, paraNumero } from '../lib/formato';
import { Abas, Campo, Cartao, Selecao, TituloSecao } from '../components/ui';

export default function Ferramentas() {
  const [aba, setAba] = useState<'1rm' | 'anilhas' | 'conversao'>('1rm');

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Calculadoras</h1>

      <Abas
        abas={[
          { valor: '1rm', rotulo: '1RM' },
          { valor: 'anilhas', rotulo: 'Anilhas' },
          { valor: 'conversao', rotulo: 'kg ↔ lb' },
        ]}
        ativa={aba}
        aoTrocar={setAba}
      />

      {aba === '1rm' && <CalculadoraDe1RM />}
      {aba === 'anilhas' && <CalculadoraDeAnilhas />}
      {aba === 'conversao' && <ConversorDeUnidade />}
    </div>
  );
}

function CalculadoraDe1RM() {
  const [peso, setPeso] = useState('80');
  const [reps, setReps] = useState('8');
  const [formula, setFormula] = useState<'epley' | 'brzycki'>('epley');

  const valorPeso = paraNumero(peso);
  const valorReps = Number(reps) || 0;
  const umRm = estimar1RM(valorPeso, valorReps, formula);

  const percentuais = useMemo(
    () =>
      [95, 90, 85, 80, 75, 70, 65, 60].map((pct) => ({
        pct,
        carga: Math.round(((umRm * pct) / 100) * 2) / 2,
      })),
    [umRm],
  );

  return (
    <div className="flex flex-col gap-4">
      <Cartao>
        <div className="flex items-center gap-2 text-texto-suave">
          <Calculator size={18} aria-hidden />
          <p className="text-sm">Estime sua carga máxima para uma repetição a partir de uma série qualquer.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Campo
            rotulo="Carga usada"
            type="text"
            inputMode="decimal"
            sufixo="kg"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
          <Campo
            rotulo="Repetições"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>

        <Selecao
          rotulo="Fórmula"
          className="mt-3"
          value={formula}
          onChange={(e) => setFormula(e.target.value as 'epley' | 'brzycki')}
        >
          <option value="epley">Epley — carga × (1 + reps/30)</option>
          <option value="brzycki">Brzycki — carga × 36 / (37 − reps)</option>
        </Selecao>

        <div className="mt-4 rounded-xl bg-primaria/10 p-4 text-center">
          <p className="text-sm text-texto-suave">1RM estimado</p>
          <p className="text-4xl font-bold text-primaria">{formatarNumero(umRm)} kg</p>
          <p className="mt-1 text-xs text-texto-suave">
            Estimativas são mais confiáveis até ~10 repetições.
          </p>
        </div>
      </Cartao>

      <section>
        <TituloSecao titulo="Tabela de percentuais" descricao="Cargas de trabalho a partir do 1RM" />
        <Cartao className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-texto-suave">
                <th scope="col" className="px-4 py-2 text-left font-medium">% do 1RM</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Carga</th>
              </tr>
            </thead>
            <tbody>
              {percentuais.map((linha) => (
                <tr key={linha.pct} className="border-t border-borda/60">
                  <td className="px-4 py-2">{linha.pct}%</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatarNumero(linha.carga)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      </section>
    </div>
  );
}

function CalculadoraDeAnilhas() {
  const [peso, setPeso] = useState('100');
  const [barra, setBarra] = useState('20');

  const resultado = useMemo(
    () => calcularAnilhas(paraNumero(peso), paraNumero(barra), ANILHAS_PADRAO),
    [peso, barra],
  );

  return (
    <div className="flex flex-col gap-4">
      <Cartao>
        <div className="flex items-center gap-2 text-texto-suave">
          <Weight size={18} aria-hidden />
          <p className="text-sm">Quantas anilhas colocar de cada lado da barra.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Campo
            rotulo="Peso total"
            type="text"
            inputMode="decimal"
            sufixo="kg"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
          <Selecao rotulo="Barra" value={barra} onChange={(e) => setBarra(e.target.value)}>
            <option value="20">Olímpica 20 kg</option>
            <option value="15">Olímpica feminina 15 kg</option>
            <option value="10">Barra leve 10 kg</option>
            <option value="7">Barra W 7 kg</option>
            <option value="0">Sem barra</option>
          </Selecao>
        </div>
      </Cartao>

      <Cartao>
        <p className="text-sm text-texto-suave">De cada lado</p>
        {resultado.porLado.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {resultado.porLado.map((item) => (
              <li
                key={item.anilha}
                className="flex items-center gap-2 rounded-xl border border-primaria/40 bg-primaria/10 px-3 py-2"
              >
                <span className="text-lg font-bold text-primaria">{formatarNumero(item.anilha)} kg</span>
                <span className="text-sm text-texto-suave">× {item.quantidade}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-texto-suave">Só a barra.</p>
        )}

        <div className="mt-4 border-t border-borda pt-3 text-sm">
          <p className="flex justify-between">
            <span className="text-texto-suave">Peso montado</span>
            <strong>{formatarNumero(resultado.pesoAlcancado)} kg</strong>
          </p>
          {!resultado.possivel && (
            <p className="mt-1 text-alerta">
              Não dá para montar exatamente {formatarNumero(paraNumero(peso))} kg com as anilhas padrão
              (diferença de {formatarNumero(Math.abs(resultado.diferenca))} kg).
            </p>
          )}
        </div>
      </Cartao>
    </div>
  );
}

function ConversorDeUnidade() {
  const unidadePadrao = useUnidade();
  const [valor, setValor] = useState('100');
  const [de, setDe] = useState<'kg' | 'lb'>(unidadePadrao);

  const numero = paraNumero(valor);
  const convertido = de === 'kg' ? kgParaLb(numero) : lbParaKg(numero);

  return (
    <Cartao>
      <div className="flex items-center gap-2 text-texto-suave">
        <Repeat size={18} aria-hidden />
        <p className="text-sm">Converta cargas entre quilos e libras.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Campo
          rotulo="Valor"
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <Selecao rotulo="Unidade de origem" value={de} onChange={(e) => setDe(e.target.value as 'kg' | 'lb')}>
          <option value="kg">Quilos (kg)</option>
          <option value="lb">Libras (lb)</option>
        </Selecao>
      </div>

      <div className="mt-4 rounded-xl bg-primaria/10 p-4 text-center">
        <p className="text-sm text-texto-suave">Resultado</p>
        <p className="text-4xl font-bold text-primaria">
          {formatarNumero(Math.round(convertido * 100) / 100)} {de === 'kg' ? 'lb' : 'kg'}
        </p>
      </div>
    </Cartao>
  );
}
