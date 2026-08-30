import type {
  DashboardItem,
  SaveDashboardItemInput,
  UpdateDashboardItemInput,
  DashboardItemKind,
} from '../contracts/dashboard.js';

export class DashboardStore {
  readonly #items = new Map<string, DashboardItem>();

  list(filters?: { kind?: DashboardItemKind; query?: string }): DashboardItem[] {
    let items = Array.from(this.#items.values()).sort((a, b) => a.order - b.order);
    if (filters?.kind) {
      items = items.filter((item) => item.kind === filters.kind);
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return items;
  }

  get(id: string): DashboardItem | null {
    return this.#items.get(id) ?? null;
  }

  save(input: SaveDashboardItemInput): DashboardItem {
    const id = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const defaultSize = input.kind === 'full_spec' ? 'large' : input.kind === 'metrics' ? 'small' : 'medium';
    const item: DashboardItem = {
      id,
      title: input.title,
      subtitle: input.subtitle,
      kind: input.kind,
      payload: input.payload,
      size: input.size ?? defaultSize,
      order: this.#items.size,
      tags: input.tags ?? [input.kind],
      createdAt: now,
      updatedAt: now,
    };
    this.#items.set(id, item);
    return item;
  }

  update(id: string, input: UpdateDashboardItemInput): DashboardItem | null {
    const existing = this.#items.get(id);
    if (!existing) return null;

    const updated: DashboardItem = {
      ...existing,
      title: input.title ?? existing.title,
      subtitle: input.subtitle ?? existing.subtitle,
      size: input.size ?? existing.size,
      order: input.order ?? existing.order,
      tags: input.tags ?? existing.tags,
      payload: input.payload ?? existing.payload,
      updatedAt: new Date().toISOString(),
    };
    this.#items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.#items.delete(id);
  }

  clear(): void {
    this.#items.clear();
  }
}

export function createDashboardStore(): DashboardStore {
  return new DashboardStore();
}
