/**
 * Run an async worker over items with bounded concurrency.
 * Results keep item order. Used to fan out AI scoring chunks without
 * booting an unbounded number of CLI-agent processes at once.
 */
export async function asyncPool<T, R>(
  limit: number,
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function lane(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]!, i);
    }
  }

  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane);
  await Promise.all(lanes);
  return results;
}

/** Split an array into chunks of `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
