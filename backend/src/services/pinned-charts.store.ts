import type {
  PinnedChart,
  PinChartInput,
  UpdatePinnedChartInput,
} from '../contracts/analytics.js';

export class PinnedChartStore {
  readonly #charts = new Map<string, PinnedChart>();

  list(): PinnedChart[] {
    return Array.from(this.#charts.values()).sort((a, b) => a.order - b.order);
  }

  get(id: string): PinnedChart | null {
    return this.#charts.get(id) ?? null;
  }

  add(input: PinChartInput): PinnedChart {
    const id = `chart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const chart: PinnedChart = {
      id,
      chart: input.chart,
      size: input.size ?? 'medium',
      order: this.#charts.size,
      createdAt: now,
      updatedAt: now,
    };
    this.#charts.set(id, chart);
    return chart;
  }

  update(id: string, input: UpdatePinnedChartInput): PinnedChart | null {
    const existing = this.#charts.get(id);
    if (!existing) return null;

    const updated: PinnedChart = {
      ...existing,
      size: input.size ?? existing.size,
      order: input.order ?? existing.order,
      chart: input.chart ?? existing.chart,
      updatedAt: new Date().toISOString(),
    };
    this.#charts.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.#charts.delete(id);
  }

  clear(): void {
    this.#charts.clear();
  }
}

export function createPinnedChartStore(): PinnedChartStore {
  return new PinnedChartStore();
}
