import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ImageOff, Plus, Ruler, Trash2 } from 'lucide-react';
import { api, apiDelete, apiGet, apiPost } from '../lib/api';
import { MEDIDAS_CORPORAIS } from '../lib/constantes';
import { formatarData, formatarDataCurta, formatarNumero, paraNumero } from '../lib/formato';
import type { Medida } from '../lib/tipos';
import { AreaTexto, Botao, Campo, Cartao, Carregando, ConfirmarAcao, Modal, Selecao, TituloSecao, Vazio } from '../components/ui';
import { CartaoGrafico, GraficoLinha, COR_INFO } from '../components/Graficos';
import { useAvisos } from '../components/Notificacoes';

type Evolucao = Record<string, Array<{ date: string; valor: number }>>;

export default function Medidas() {
  const queryClient = useQueryClient();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [registrando, setRegistrando] = useState(false);
  const [excluindo, setExcluindo] = useState<Medida | null>(null);
  const [metricaGrafico, setMetricaGrafico] = useState('peso');
  const [comparando, setComparando] = useState(false);
  const [novo, setNovo] = useState<{
    date: string;
    weightKg: string;
    bodyFatPct: string;
    measures: Record<string, string>;
    notes: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    weightKg: '',
    bodyFatPct: '',
    measures: {},
    notes: '',
  });

  const { data: medidas, isLoading } = useQuery({
    queryKey: ['medidas'],
    queryFn: () => apiGet<Medida[]>('/medidas'),
  });

  const { data: evolucao } = useQuery({
    queryKey: ['medidas-evolucao'],
    queryFn: () => apiGet<Evolucao>('/medidas/evolucao'),
  });

  const registrar = useMutation({
    mutationFn: () =>
      apiPost<Medida>('/medidas', {
        date: new Date(`${novo.date}T12:00:00`).toISOString(),
        weightKg: novo.weightKg ? paraNumero(novo.weightKg) : null,
        bodyFatPct: novo.bodyFatPct ? paraNumero(novo.bodyFatPct) : null,
        measures: Object.fromEntries(
          Object.entries(novo.measures)
            .filter(([, valor]) => valor !== '')
            .map(([chave, valor]) => [chave, paraNumero(valor)]),
        ),
        notes: novo.notes || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setRegistrando(false);
      setNovo({ date: new Date().toISOString().slice(0, 10), weightKg: '', bodyFatPct: '', measures: {}, notes: '' });
      sucesso('Medidas registradas!');
    },
    onError: () => avisarErro('Não foi possível salvar as medidas'),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => apiDelete(`/medidas/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setExcluindo(null);
    },
  });

  const enviarFoto = useMutation({
    mutationFn: async ({ id, arquivo }: { id: string; arquivo: File }) => {
      const dados = new FormData();
      dados.append('foto', arquivo);
      return api<Medida>(`/medidas/${id}/fotos`, { method: 'POST', body: dados });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['medidas'] });
      sucesso('Foto adicionada');
    },
    onError: () => avisarErro('Não foi possível enviar a foto'),
  });

  const metricas = useMemo(
    () => [
      { valor: 'peso', rotulo: 'Peso', unidade: 'kg' },
      { valor: 'gordura', rotulo: 'Gordura', unidade: '%' },
      ...MEDIDAS_CORPORAIS.map((m) => ({ valor: m.chave, rotulo: m.rotulo, unidade: 'cm' })),
    ],
    [],
  );

  const serie = evolucao?.[metricaGrafico] ?? [];
  const unidadeMetrica = metricas.find((m) => m.valor === metricaGrafico)?.unidade ?? '';

  const comFotos = (medidas ?? []).filter((m) => m.photos.length > 0);
  const ultimo = medidas?.[0];
  const penultimo = medidas?.[1];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Medidas</h1>
        <Botao icone={<Plus size={18} />} onClick={() => setRegistrando(true)}>
          Registrar
        </Botao>
      </div>

      {isLoading ? (
        <Carregando />
      ) : medidas?.length ? (
        <>
          {ultimo && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Cartao className="p-3.5">
                <p className="text-xs font-medium uppercase text-texto-suave">Peso atual</p>
                <p className="mt-1 text-2xl font-bold">{ultimo.weightKg ? `${formatarNumero(ultimo.weightKg)} kg` : '—'}</p>
                {penultimo?.weightKg && ultimo.weightKg && (
                  <p className="text-xs text-texto-suave">
                    {ultimo.weightKg - penultimo.weightKg > 0 ? '+' : ''}
                    {formatarNumero(ultimo.weightKg - penultimo.weightKg)} kg desde a última
                  </p>
                )}
              </Cartao>
              <Cartao className="p-3.5">
                <p className="text-xs font-medium uppercase text-texto-suave">Gordura</p>
                <p className="mt-1 text-2xl font-bold">
                  {ultimo.bodyFatPct ? `${formatarNumero(ultimo.bodyFatPct)}%` : '—'}
                </p>
              </Cartao>
              <Cartao className="p-3.5">
                <p className="text-xs font-medium uppercase text-texto-suave">Braço</p>
                <p className="mt-1 text-2xl font-bold">
                  {ultimo.measures.braco ? `${formatarNumero(ultimo.measures.braco)} cm` : '—'}
                </p>
              </Cartao>
              <Cartao className="p-3.5">
                <p className="text-xs font-medium uppercase text-texto-suave">Cintura</p>
                <p className="mt-1 text-2xl font-bold">
                  {ultimo.measures.cintura ? `${formatarNumero(ultimo.measures.cintura)} cm` : '—'}
                </p>
              </Cartao>
            </section>
          )}

          <section>
            <TituloSecao titulo="Evolução" />
            <div className="mb-3">
              <Selecao
                value={metricaGrafico}
                onChange={(e) => setMetricaGrafico(e.target.value)}
                aria-label="Escolher medida do gráfico"
              >
                {metricas.map((metrica) => (
                  <option key={metrica.valor} value={metrica.valor}>
                    {metrica.rotulo}
                  </option>
                ))}
              </Selecao>
            </div>

            {serie.length > 1 ? (
              <CartaoGrafico titulo={metricas.find((m) => m.valor === metricaGrafico)?.rotulo ?? ''}>
                <GraficoLinha
                  dados={serie.map((ponto) => ({
                    data: formatarDataCurta(ponto.date),
                    valor: ponto.valor,
                  }))}
                  chaveX="data"
                  chaveY="valor"
                  cor={COR_INFO}
                  formatador={(valor) => `${formatarNumero(valor)} ${unidadeMetrica}`}
                />
              </CartaoGrafico>
            ) : (
              <p className="text-sm text-texto-suave">Registre pelo menos duas medições para ver o gráfico.</p>
            )}
          </section>

          {comFotos.length > 0 && (
            <section>
              <TituloSecao
                titulo="Fotos de progresso"
                acao={
                  comFotos.length > 1 ? (
                    <button onClick={() => setComparando(true)} className="text-sm font-medium text-primaria">
                      Comparar
                    </button>
                  ) : undefined
                }
              />
              <div className="rolagem-oculta -mx-4 flex gap-3 overflow-x-auto px-4">
                {comFotos.map((medida) =>
                  medida.photos.map((foto) => (
                    <figure key={foto} className="w-36 shrink-0">
                      <img src={foto} alt={`Foto de ${formatarData(medida.date)}`} className="h-48 w-36 rounded-xl border border-borda object-cover" />
                      <figcaption className="mt-1 text-center text-xs text-texto-suave">
                        {formatarData(medida.date)}
                      </figcaption>
                    </figure>
                  )),
                )}
              </div>
            </section>
          )}

          <section>
            <TituloSecao titulo="Registros" />
            <div className="flex flex-col gap-2">
              {medidas.map((medida) => (
                <Cartao key={medida.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{formatarData(medida.date)}</p>
                      <p className="text-sm text-texto-suave">
                        {[
                          medida.weightKg ? `${formatarNumero(medida.weightKg)} kg` : null,
                          medida.bodyFatPct ? `${formatarNumero(medida.bodyFatPct)}% gordura` : null,
                          ...MEDIDAS_CORPORAIS.filter((m) => medida.measures[m.chave]).map(
                            (m) => `${m.rotulo} ${formatarNumero(medida.measures[m.chave])} cm`,
                          ),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {medida.notes && <p className="mt-1 text-sm text-texto-suave">{medida.notes}</p>}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <label
                        className="cursor-pointer rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                        aria-label={`Adicionar foto em ${formatarData(medida.date)}`}
                      >
                        <Camera size={18} />
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const arquivo = e.target.files?.[0];
                            if (arquivo) enviarFoto.mutate({ id: medida.id, arquivo });
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        onClick={() => setExcluindo(medida)}
                        className="rounded-lg p-2 text-texto-suave hover:bg-perigo/10 hover:text-perigo"
                        aria-label={`Excluir registro de ${formatarData(medida.date)}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </Cartao>
              ))}
            </div>
          </section>
        </>
      ) : (
        <Vazio
          icone={<Ruler size={32} />}
          titulo="Nenhuma medida registrada"
          descricao="Acompanhe peso, percentual de gordura e circunferências ao longo do tempo."
          acao={
            <Botao icone={<Plus size={18} />} onClick={() => setRegistrando(true)}>
              Registrar medidas
            </Botao>
          }
        />
      )}

      <Modal
        aberto={registrando}
        aoFechar={() => setRegistrando(false)}
        titulo="Registrar medidas"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setRegistrando(false)}>
              Cancelar
            </Botao>
            <Botao larguraTotal carregando={registrar.isPending} onClick={() => registrar.mutate()}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Data"
            type="date"
            value={novo.date}
            onChange={(e) => setNovo((n) => ({ ...n, date: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo="Peso"
              type="text"
              inputMode="decimal"
              sufixo="kg"
              value={novo.weightKg}
              onChange={(e) => setNovo((n) => ({ ...n, weightKg: e.target.value }))}
            />
            <Campo
              rotulo="Gordura"
              type="text"
              inputMode="decimal"
              sufixo="%"
              value={novo.bodyFatPct}
              onChange={(e) => setNovo((n) => ({ ...n, bodyFatPct: e.target.value }))}
            />
          </div>

          <div>
            <p className="rotulo">Circunferências (cm)</p>
            <div className="grid grid-cols-2 gap-3">
              {MEDIDAS_CORPORAIS.map((medida) => (
                <Campo
                  key={medida.chave}
                  rotulo={medida.rotulo}
                  type="text"
                  inputMode="decimal"
                  value={novo.measures[medida.chave] ?? ''}
                  onChange={(e) =>
                    setNovo((n) => ({ ...n, measures: { ...n.measures, [medida.chave]: e.target.value } }))
                  }
                />
              ))}
            </div>
          </div>

          <AreaTexto
            rotulo="Observações"
            value={novo.notes}
            onChange={(e) => setNovo((n) => ({ ...n, notes: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal aberto={comparando} aoFechar={() => setComparando(false)} titulo="Comparar fotos" largo>
        <ComparadorDeFotos medidas={comFotos} />
      </Modal>

      <ConfirmarAcao
        aberto={excluindo !== null}
        titulo="Excluir registro?"
        mensagem="As medidas e fotos desse dia serão removidas."
        textoConfirmar="Excluir"
        perigoso
        carregando={excluir.isPending}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && excluir.mutate(excluindo.id)}
      />
    </div>
  );
}

/** Duas fotos lado a lado, escolhidas pelo usuário. */
function ComparadorDeFotos({ medidas }: { medidas: Medida[] }) {
  const [esquerda, setEsquerda] = useState(medidas[medidas.length - 1]?.id ?? '');
  const [direita, setDireita] = useState(medidas[0]?.id ?? '');

  const buscar = (id: string) => medidas.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Selecao value={esquerda} onChange={(e) => setEsquerda(e.target.value)} aria-label="Foto da esquerda">
          {medidas.map((m) => (
            <option key={m.id} value={m.id}>
              {formatarData(m.date)}
            </option>
          ))}
        </Selecao>
        <Selecao value={direita} onChange={(e) => setDireita(e.target.value)} aria-label="Foto da direita">
          {medidas.map((m) => (
            <option key={m.id} value={m.id}>
              {formatarData(m.date)}
            </option>
          ))}
        </Selecao>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[esquerda, direita].map((id, lado) => {
          const medida = buscar(id);
          return (
            <figure key={lado}>
              {medida?.photos[0] ? (
                <img
                  src={medida.photos[0]}
                  alt={`Foto de ${formatarData(medida.date)}`}
                  className="aspect-[3/4] w-full rounded-xl border border-borda object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-borda text-texto-suave">
                  <ImageOff size={28} aria-hidden />
                </div>
              )}
              <figcaption className="mt-1 text-center text-sm">
                {medida ? formatarData(medida.date) : '—'}
                {medida?.weightKg ? ` · ${formatarNumero(medida.weightKg)} kg` : ''}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
