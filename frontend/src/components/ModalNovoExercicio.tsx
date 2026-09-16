import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, TIPOS_EXERCICIO } from '../lib/constantes';
import type { Exercicio } from '../lib/tipos';
import { AreaTexto, Botao, Campo, Modal, Selecao } from './ui';
import { useAvisos } from './Notificacoes';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Recebe o exercício recém-criado — permite usá-lo na hora. */
  aoCriar?: (exercicio: Exercicio) => void;
  nomeInicial?: string;
}

/**
 * Cadastro de exercício personalizado.
 *
 * Aparece tanto na biblioteca quanto na hora de montar a rotina ou de treinar:
 * se o movimento não existe na lista, dá para criar sem perder o que estava
 * fazendo.
 */
export default function ModalNovoExercicio({ aberto, aoFechar, aoCriar, nomeInicial = '' }: Props) {
  const queryClient = useQueryClient();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [dados, setDados] = useState({
    name: nomeInicial,
    muscleGroup: 'peito',
    equipment: 'barra',
    type: 'forca',
    instructions: '',
  });

  const criar = useMutation({
    mutationFn: () => apiPost<Exercicio>('/exercicios', { ...dados, secondaryMuscles: [] }),
    onSuccess: async (exercicio) => {
      await queryClient.invalidateQueries({ queryKey: ['exercicios'] });
      sucesso(`"${exercicio.name}" criado!`);
      aoCriar?.(exercicio);
      setDados({ name: '', muscleGroup: 'peito', equipment: 'barra', type: 'forca', instructions: '' });
      aoFechar();
    },
    onError: () => avisarErro('Não foi possível criar o exercício'),
  });

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo exercício"
      rodape={
        <div className="flex gap-2">
          <Botao variante="secundario" larguraTotal onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            larguraTotal
            carregando={criar.isPending}
            disabled={dados.name.trim().length < 2}
            onClick={() => criar.mutate()}
          >
            Criar
          </Botao>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          rotulo="Nome"
          autoFocus
          placeholder="Ex.: Supino com pegada neutra"
          value={dados.name}
          onChange={(e) => setDados((d) => ({ ...d, name: e.target.value }))}
        />
        <Selecao
          rotulo="Grupo muscular"
          value={dados.muscleGroup}
          onChange={(e) => setDados((d) => ({ ...d, muscleGroup: e.target.value }))}
        >
          {Object.entries(GRUPOS_MUSCULARES).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Equipamento"
          value={dados.equipment}
          onChange={(e) => setDados((d) => ({ ...d, equipment: e.target.value }))}
        >
          {Object.entries(EQUIPAMENTOS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Tipo"
          value={dados.type}
          onChange={(e) => setDados((d) => ({ ...d, type: e.target.value }))}
        >
          {Object.entries(TIPOS_EXERCICIO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <AreaTexto
          rotulo="Como executar (opcional)"
          placeholder="Anote a execução para não esquecer depois…"
          value={dados.instructions}
          onChange={(e) => setDados((d) => ({ ...d, instructions: e.target.value }))}
        />
      </div>
    </Modal>
  );
}
