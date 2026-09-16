import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Camera, Download, LogOut, Moon, Palette, Ruler, Save, Sun, Trash2, Upload, User, Users, KeyRound, FileJson,
} from 'lucide-react';
import { api, apiDelete, apiPatch, apiPost, lerSessao } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DIAS_SEMANA, NIVEIS, OBJETIVOS, SEXOS } from '../lib/constantes';
import { paraNumero } from '../lib/formato';
import { notificacoesSuportadas, pedirPermissaoNotificacoes } from '../lib/lembretes';
import type { Usuario } from '../lib/tipos';
import { AreaTexto, Botao, Campo, Cartao, Modal, Selecao, TituloSecao } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function Configuracoes() {
  const { usuario, contas, trocarPara, atualizarUsuario, aplicarTema, sair } = useAuth();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { sucesso, erro: avisarErro, avisar } = useAvisos();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [perfil, setPerfil] = useState({
    name: '',
    birthDate: '',
    sex: '',
    heightCm: '',
    weightKg: '',
    goal: '',
    level: '',
  });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senhas, setSenhas] = useState({ atual: '', nova: '' });
  const [importando, setImportando] = useState(false);
  const [csvImportacao, setCsvImportacao] = useState('');
  const [excluindoConta, setExcluindoConta] = useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState({ password: '', confirmacao: '' });

  useEffect(() => {
    if (!usuario) return;
    setPerfil({
      name: usuario.name,
      birthDate: usuario.birthDate ? usuario.birthDate.slice(0, 10) : '',
      sex: usuario.sex ?? '',
      heightCm: usuario.heightCm ? String(usuario.heightCm) : '',
      weightKg: usuario.weightKg ? String(usuario.weightKg) : '',
      goal: usuario.goal ?? '',
      level: usuario.level ?? '',
    });
  }, [usuario]);

  const salvarPerfil = useMutation({
    mutationFn: () =>
      apiPatch<Usuario>('/usuarios/eu', {
        name: perfil.name.trim(),
        birthDate: perfil.birthDate ? new Date(`${perfil.birthDate}T12:00:00`).toISOString() : null,
        sex: perfil.sex || null,
        heightCm: perfil.heightCm ? Number(perfil.heightCm) : null,
        weightKg: perfil.weightKg ? paraNumero(perfil.weightKg) : null,
        goal: perfil.goal || null,
        level: perfil.level || null,
      }),
    onSuccess: (novo) => {
      atualizarUsuario(novo);
      sucesso('Perfil atualizado');
    },
    onError: () => avisarErro('Não foi possível salvar o perfil'),
  });

  const salvarPreferencias = useMutation({
    mutationFn: (dados: Record<string, unknown>) => apiPatch<Usuario>('/usuarios/eu/preferencias', dados),
    onSuccess: (novo) => {
      atualizarUsuario(novo);
      aplicarTema(novo.theme);
    },
  });

  const enviarFoto = useMutation({
    mutationFn: async (arquivo: File) => {
      const dados = new FormData();
      dados.append('foto', arquivo);
      return api<Usuario>('/usuarios/eu/foto', { method: 'POST', body: dados });
    },
    onSuccess: (novo) => {
      atualizarUsuario(novo);
      sucesso('Foto atualizada');
    },
    onError: () => avisarErro('Não foi possível enviar a foto'),
  });

  const trocarSenha = useMutation({
    mutationFn: () => apiPatch('/usuarios/eu/senha', { senhaAtual: senhas.atual, novaSenha: senhas.nova }),
    onSuccess: async () => {
      sucesso('Senha alterada. Entre novamente com a nova senha.');
      setTrocandoSenha(false);
      await sair();
      navegar('/entrar');
    },
    onError: () => avisarErro('Não foi possível trocar a senha. Confira a senha atual.'),
  });

  const importar = useMutation({
    mutationFn: () => apiPost<{ mensagem: string }>('/dados/importar', { csv: csvImportacao, origem: 'auto' }),
    onSuccess: async (resposta) => {
      await queryClient.invalidateQueries();
      setImportando(false);
      setCsvImportacao('');
      sucesso(resposta.mensagem);
    },
    onError: () => avisarErro('Não foi possível importar o arquivo. Confira se é um CSV do Strong ou do Hevy.'),
  });

  const excluirConta = useMutation({
    mutationFn: () => apiDelete('/usuarios/eu', confirmacaoExclusao),
    onSuccess: async () => {
      await sair();
      navegar('/');
    },
    onError: () => avisarErro('Não foi possível excluir a conta. Confira a senha e a confirmação.'),
  });

  /** O download precisa do token, então baixamos via fetch autenticado. */
  const exportar = async (formato: 'json' | 'csv') => {
    try {
      const resposta = await fetch(`/api/dados/exportar?formato=${formato}`, {
        headers: { Authorization: `Bearer ${lerSessao()?.accessToken ?? ''}` },
      });
      if (!resposta.ok) throw new Error('falha');
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `treinos-${new Date().toISOString().slice(0, 10)}.${formato}`;
      link.click();
      URL.revokeObjectURL(url);
      sucesso('Download iniciado');
    } catch {
      avisarErro('Não foi possível exportar os dados');
    }
  };

  if (!usuario) return null;

  const alternarDia = (dia: string) => {
    const dias = usuario.trainingDays.includes(dia)
      ? usuario.trainingDays.filter((d) => d !== dia)
      : [...usuario.trainingDays, dia];
    salvarPreferencias.mutate({ trainingDays: dias });
  };

  const alternarLembretes = async (ligado: boolean) => {
    if (ligado) {
      const permissao = await pedirPermissaoNotificacoes();
      if (permissao !== 'granted') {
        avisar('Ative as notificações do navegador para receber os lembretes.');
        return;
      }
    }
    salvarPreferencias.mutate({ remindersOn: ligado, reminderTime: usuario.reminderTime ?? '18:30' });
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Perfil e configurações</h1>

      {/* Perfil ------------------------------------------------------------ */}
      <section>
        <TituloSecao titulo="Perfil" />
        <Cartao className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-borda bg-superficie-2 text-2xl font-semibold">
              {usuario.photoUrl ? (
                <img src={usuario.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                usuario.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <Botao variante="secundario" tamanho="sm" icone={<Camera size={16} />} onClick={() => arquivoRef.current?.click()}>
                Trocar foto
              </Botao>
              <input
                ref={arquivoRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) enviarFoto.mutate(arquivo);
                  e.target.value = '';
                }}
              />
              <p className="mt-1.5 text-xs text-texto-suave">{usuario.email}</p>
            </div>
          </div>

          <Campo rotulo="Nome" value={perfil.name} onChange={(e) => setPerfil((p) => ({ ...p, name: e.target.value }))} />

          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo="Data de nascimento"
              type="date"
              value={perfil.birthDate}
              onChange={(e) => setPerfil((p) => ({ ...p, birthDate: e.target.value }))}
            />
            <Selecao rotulo="Sexo" value={perfil.sex} onChange={(e) => setPerfil((p) => ({ ...p, sex: e.target.value }))}>
              <option value="">Não informar</option>
              {Object.entries(SEXOS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo="Altura"
              type="number"
              inputMode="numeric"
              sufixo="cm"
              value={perfil.heightCm}
              onChange={(e) => setPerfil((p) => ({ ...p, heightCm: e.target.value }))}
            />
            <Campo
              rotulo="Peso atual"
              type="text"
              inputMode="decimal"
              sufixo="kg"
              value={perfil.weightKg}
              onChange={(e) => setPerfil((p) => ({ ...p, weightKg: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Selecao rotulo="Objetivo" value={perfil.goal} onChange={(e) => setPerfil((p) => ({ ...p, goal: e.target.value }))}>
              <option value="">Não informar</option>
              {Object.entries(OBJETIVOS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
            <Selecao rotulo="Nível" value={perfil.level} onChange={(e) => setPerfil((p) => ({ ...p, level: e.target.value }))}>
              <option value="">Não informar</option>
              {Object.entries(NIVEIS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
          </div>

          <Botao icone={<Save size={18} />} carregando={salvarPerfil.isPending} onClick={() => salvarPerfil.mutate()}>
            Salvar perfil
          </Botao>
        </Cartao>
      </section>

      {/* Preferências ------------------------------------------------------ */}
      <section>
        <TituloSecao titulo="Preferências" />
        <Cartao className="flex flex-col gap-5">
          <div>
            <p className="rotulo flex items-center gap-2">
              <Ruler size={15} /> Unidade de peso
            </p>
            <div className="flex gap-2">
              {(['kg', 'lb'] as const).map((unidade) => (
                <Botao
                  key={unidade}
                  variante={usuario.weightUnit === unidade ? 'primario' : 'secundario'}
                  larguraTotal
                  onClick={() => salvarPreferencias.mutate({ weightUnit: unidade })}
                >
                  {unidade === 'kg' ? 'Quilos (kg)' : 'Libras (lb)'}
                </Botao>
              ))}
            </div>
          </div>

          <div>
            <p className="rotulo flex items-center gap-2">
              <Palette size={15} /> Tema
            </p>
            <div className="flex gap-2">
              <Botao
                variante={usuario.theme === 'dark' ? 'primario' : 'secundario'}
                larguraTotal
                icone={<Moon size={16} />}
                onClick={() => salvarPreferencias.mutate({ theme: 'dark' })}
              >
                Escuro
              </Botao>
              <Botao
                variante={usuario.theme === 'light' ? 'primario' : 'secundario'}
                larguraTotal
                icone={<Sun size={16} />}
                onClick={() => salvarPreferencias.mutate({ theme: 'light' })}
              >
                Claro
              </Botao>
            </div>
          </div>

          <div>
            <p className="rotulo">Dias de treino</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => {
                const marcado = usuario.trainingDays.includes(dia.valor);
                return (
                  <button
                    key={dia.valor}
                    onClick={() => alternarDia(dia.valor)}
                    aria-pressed={marcado}
                    className={`min-h-[44px] min-w-[52px] rounded-xl border px-3 text-sm font-medium transition-colors ${
                      marcado ? 'border-primaria bg-primaria text-[#04140a]' : 'border-borda bg-superficie-2 text-texto-suave'
                    }`}
                  >
                    {dia.rotulo}
                  </button>
                );
              })}
            </div>
          </div>

          <Selecao
            rotulo="Tempo de descanso padrão"
            value={usuario.defaultRestSec}
            onChange={(e) => salvarPreferencias.mutate({ defaultRestSec: Number(e.target.value) })}
          >
            {[30, 45, 60, 75, 90, 120, 150, 180, 240].map((segundos) => (
              <option key={segundos} value={segundos}>
                {segundos < 60 ? `${segundos} segundos` : `${Math.floor(segundos / 60)}min${segundos % 60 ? ` ${segundos % 60}s` : ''}`}
              </option>
            ))}
          </Selecao>

          {notificacoesSuportadas() && (
            <div>
              <p className="rotulo flex items-center gap-2">
                <Bell size={15} /> Lembretes de treino
              </p>
              <div className="flex items-center gap-3">
                <Botao
                  variante={usuario.remindersOn ? 'primario' : 'secundario'}
                  onClick={() => alternarLembretes(!usuario.remindersOn)}
                >
                  {usuario.remindersOn ? 'Ativados' : 'Desativados'}
                </Botao>
                {usuario.remindersOn && (
                  <Campo
                    type="time"
                    aria-label="Horário do lembrete"
                    value={usuario.reminderTime ?? '18:30'}
                    onChange={(e) => salvarPreferencias.mutate({ reminderTime: e.target.value })}
                  />
                )}
              </div>
              <p className="mt-1.5 text-xs text-texto-suave">
                Avisamos nos dias marcados acima, no horário escolhido.
              </p>
            </div>
          )}
        </Cartao>
      </section>

      {/* Dados ------------------------------------------------------------- */}
      <section>
        <TituloSecao titulo="Seus dados" />
        <Cartao className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal icone={<FileJson size={18} />} onClick={() => exportar('json')}>
            Exportar tudo em JSON
          </Botao>
          <Botao variante="secundario" larguraTotal icone={<Download size={18} />} onClick={() => exportar('csv')}>
            Exportar treinos em CSV
          </Botao>
          <Botao variante="secundario" larguraTotal icone={<Upload size={18} />} onClick={() => setImportando(true)}>
            Importar do Strong ou Hevy
          </Botao>
        </Cartao>
      </section>

      {/* Treino em dupla ---------------------------------------------------- */}
      <section>
        <TituloSecao
          titulo="Treino em dupla"
          descricao="Duas pessoas no mesmo aparelho, cada uma registrando na própria conta"
        />
        <Cartao className="flex flex-col gap-2">
          {contas.map((conta) => (
            <button
              key={conta.id}
              onClick={() => conta.id !== usuario.id && trocarPara(conta.id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                conta.id === usuario.id ? 'border-primaria bg-primaria/10' : 'border-borda hover:bg-superficie-2'
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-superficie-2 font-semibold">
                {conta.photoUrl ? (
                  <img src={conta.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  conta.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{conta.name}</span>
                <span className="block truncate text-sm text-texto-suave">
                  {conta.id === usuario.id ? 'conta atual' : conta.email}
                </span>
              </span>
            </button>
          ))}

          <Botao
            variante="secundario"
            larguraTotal
            icone={<Users size={18} />}
            onClick={() => navegar('/entrar?adicionar=1')}
          >
            Adicionar outra conta
          </Botao>
        </Cartao>
      </section>

      {/* Conta ------------------------------------------------------------- */}
      <section>
        <TituloSecao titulo="Conta" />
        <Cartao className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal icone={<KeyRound size={18} />} onClick={() => setTrocandoSenha(true)}>
            Trocar senha
          </Botao>
          <Botao
            variante="secundario"
            larguraTotal
            icone={<LogOut size={18} />}
            onClick={async () => {
              await sair();
              navegar('/entrar');
            }}
          >
            Sair da conta
          </Botao>
          <Botao variante="perigo" larguraTotal icone={<Trash2 size={18} />} onClick={() => setExcluindoConta(true)}>
            Excluir conta
          </Botao>
        </Cartao>
      </section>

      <p className="text-center text-xs text-texto-suave">
        <User size={12} className="mr-1 inline" aria-hidden />
        Conta criada em {new Date(usuario.createdAt).toLocaleDateString('pt-BR')}
      </p>

      {/* Modais ------------------------------------------------------------ */}
      <Modal
        aberto={trocandoSenha}
        aoFechar={() => setTrocandoSenha(false)}
        titulo="Trocar senha"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setTrocandoSenha(false)}>
              Cancelar
            </Botao>
            <Botao
              larguraTotal
              carregando={trocarSenha.isPending}
              disabled={senhas.nova.length < 8}
              onClick={() => trocarSenha.mutate()}
            >
              Trocar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Senha atual"
            type="password"
            autoComplete="current-password"
            value={senhas.atual}
            onChange={(e) => setSenhas((s) => ({ ...s, atual: e.target.value }))}
          />
          <Campo
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            value={senhas.nova}
            onChange={(e) => setSenhas((s) => ({ ...s, nova: e.target.value }))}
            dica="Mínimo de 8 caracteres, com letra e número"
          />
        </div>
      </Modal>

      <Modal
        aberto={importando}
        aoFechar={() => setImportando(false)}
        titulo="Importar treinos"
        largo
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setImportando(false)}>
              Cancelar
            </Botao>
            <Botao
              larguraTotal
              carregando={importar.isPending}
              disabled={csvImportacao.trim().length < 10}
              onClick={() => importar.mutate()}
            >
              Importar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto-suave">
            Exporte seus dados no app antigo (Strong ou Hevy), abra o arquivo CSV e cole o conteúdo abaixo — ou selecione
            o arquivo direto.
          </p>

          <label className="cursor-pointer rounded-xl border border-dashed border-borda px-4 py-6 text-center text-sm text-texto-suave hover:border-primaria/50">
            <Upload size={22} className="mx-auto mb-2" aria-hidden />
            Selecionar arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) setCsvImportacao(await arquivo.text());
                e.target.value = '';
              }}
            />
          </label>

          <AreaTexto
            rotulo="Conteúdo do CSV"
            rows={6}
            value={csvImportacao}
            onChange={(e) => setCsvImportacao(e.target.value)}
            placeholder="Date,Workout Name,Exercise Name,Set Order,Weight,Reps…"
          />
          {csvImportacao && (
            <p className="text-xs text-texto-suave">{csvImportacao.split('\n').length} linhas carregadas</p>
          )}
        </div>
      </Modal>

      <Modal
        aberto={excluindoConta}
        aoFechar={() => setExcluindoConta(false)}
        titulo="Excluir conta"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setExcluindoConta(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              larguraTotal
              carregando={excluirConta.isPending}
              disabled={confirmacaoExclusao.confirmacao.toUpperCase() !== 'EXCLUIR' || !confirmacaoExclusao.password}
              onClick={() => excluirConta.mutate()}
            >
              Excluir para sempre
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo">
            Esta ação apaga definitivamente seus treinos, rotinas, medidas e metas. Não dá para desfazer.
            Considere exportar seus dados antes.
          </p>
          <Campo
            rotulo="Sua senha"
            type="password"
            autoComplete="current-password"
            value={confirmacaoExclusao.password}
            onChange={(e) => setConfirmacaoExclusao((c) => ({ ...c, password: e.target.value }))}
          />
          <Campo
            rotulo='Digite "EXCLUIR" para confirmar'
            value={confirmacaoExclusao.confirmacao}
            onChange={(e) => setConfirmacaoExclusao((c) => ({ ...c, confirmacao: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
