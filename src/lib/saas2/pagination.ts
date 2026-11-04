/** Fetch until an empty page: a server cap smaller than our requested range must not truncate money totals. */
export async function readAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  limit = 20000,
): Promise<T[]> {
  const result: T[] = [];
  let offset = 0;
  while (offset <= limit) {
    const { data, error } = await query(offset, offset + 999);
    if (error) throw Error(error.message);
    if (data != null && !Array.isArray(data))
      throw Error("Resposta de consulta inválida.");
    const rows = (data || []) as T[];
    if (rows.length === 0) return result;
    result.push(...rows);
    if (result.length > limit)
      throw Error(
        "Volume acima do limite seguro. Reduza o período ou solicite agregação no banco.",
      );
    offset += rows.length;
  }
  throw Error("Consulta incompleta.");
}
