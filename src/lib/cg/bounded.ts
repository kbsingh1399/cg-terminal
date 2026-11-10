/**
 * Tiny insertion-order bounded map — the same eviction policy the shared
 * upstream client uses (client.ts). Every module-level response cache in the
 * API routes must go through this so a hostile or buggy client cannot grow
 * server memory by varying query params (e.g. ?endTime=1..N sweeps).
 *
 * Insertion-order eviction keeps the working set (the handful of key combos
 * the UI actually polls) hot while capping worst-case memory.
 */
export class BoundedMap<V> {
  private m = new Map<string, V>();
  constructor(private readonly max: number) {}

  get(key: string): V | undefined {
    return this.m.get(key);
  }

  set(key: string, value: V): void {
    if (!this.m.has(key) && this.m.size >= this.max) {
      // evict the oldest inserted entry
      const oldest = this.m.keys().next().value;
      if (oldest !== undefined) this.m.delete(oldest);
    }
    this.m.set(key, value);
  }

  get size(): number {
    return this.m.size;
  }
}
