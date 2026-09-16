import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { toJson } from '../src/lib/json';

export const app: Express = createApp();

/** Limpa todas as tabelas entre os testes (ordem respeita as chaves estrangeiras). */
export async function limparBanco() {
  await prisma.photo.deleteMany();
  await prisma.personalRecord.deleteMany();
  await prisma.workoutSet.deleteMany();
  await prisma.workoutExercise.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.routineExercise.deleteMany();
  await prisma.routineDay.deleteMany();
  await prisma.routine.deleteMany();
  await prisma.favoriteExercise.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.bodyMeasurement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.user.deleteMany();
}

export interface Sessao {
  usuario: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

/** Cria um usuário e devolve a sessão autenticada. */
export async function criarUsuario(
  email = 'teste@treinos.app',
  senha = 'SenhaForte123',
  nome = 'Usuário Teste',
): Promise<Sessao> {
  const resposta = await request(app)
    .post('/api/auth/registrar')
    .send({ name: nome, email, password: senha });

  if (resposta.status !== 201) {
    throw new Error(`Falha ao criar usuário de teste: ${JSON.stringify(resposta.body)}`);
  }
  return resposta.body as Sessao;
}

export const auth = (sessao: Sessao) => ({ Authorization: `Bearer ${sessao.accessToken}` });

/** Cria um exercício global usado pelos testes. */
export async function criarExercicio(nome = 'Supino reto com barra') {
  return prisma.exercise.create({
    data: {
      name: nome,
      muscleGroup: 'peito',
      secondaryMuscles: toJson(['triceps']),
      equipment: 'barra',
      type: 'forca',
      instructions: 'Execução padrão.',
    },
  });
}
