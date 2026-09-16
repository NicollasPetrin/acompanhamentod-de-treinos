import { parseJson } from './json';

/** Remove campos sensíveis e converte colunas JSON-em-texto para objetos. */
export function serializeUser(user: Record<string, unknown>) {
  const { passwordHash: _omit, trainingDays, ...rest } = user as never as {
    passwordHash: string;
    trainingDays: string;
  } & Record<string, unknown>;
  return { ...rest, trainingDays: parseJson<string[]>(trainingDays, []) };
}

export function serializeExercise(ex: Record<string, unknown>) {
  const { secondaryMuscles, ...rest } = ex as { secondaryMuscles: string } & Record<string, unknown>;
  return {
    ...rest,
    secondaryMuscles: parseJson<string[]>(secondaryMuscles, []),
    // Ilustração gerada pelo próprio backend quando não há imagem cadastrada
    imageUrl: (rest.imageUrl as string | null) ?? `/api/exercicios/${rest.id}/imagem.svg`,
  };
}

export function serializeSet(set: Record<string, unknown>) {
  const { prTypes, ...rest } = set as { prTypes: string } & Record<string, unknown>;
  return { ...rest, prTypes: parseJson<string[]>(prTypes, []) };
}

export function serializeMeasurement(m: Record<string, unknown>) {
  const { measures, photos, ...rest } = m as {
    measures: string;
    photos: string;
  } & Record<string, unknown>;
  return {
    ...rest,
    measures: parseJson<Record<string, number>>(measures, {}),
    photos: parseJson<string[]>(photos, []),
  };
}

export function serializeWorkout(w: Record<string, unknown>) {
  const exercises = w.exercises as Array<Record<string, unknown>> | undefined;
  if (!exercises) return w;
  return {
    ...w,
    exercises: exercises.map((we) => ({
      ...we,
      exercise: we.exercise ? serializeExercise(we.exercise as Record<string, unknown>) : undefined,
      sets: ((we.sets ?? []) as Array<Record<string, unknown>>).map(serializeSet),
    })),
  };
}
