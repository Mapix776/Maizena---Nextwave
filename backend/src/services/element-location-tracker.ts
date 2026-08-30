import type { TracerSpec } from '../contracts/ui.js';

export interface RenderedElementLocation {
  elementId: string;
  messageId: string;
  runId: string;
  projectionScope: string;
  lastUpdatedAt: number;
}

export class ElementLocationTracker {
  readonly #locations = new Map<string, RenderedElementLocation>();

  /**
   * Register all element IDs that live in a specific chat message / bubble.
   */
  registerMessageElements(
    messageId: string,
    runId: string,
    elementIds: string[],
    projectionScope = 'default',
  ): void {
    const now = Date.now();

    for (const elementId of elementIds) {
      if (elementId === 'assistant-message') continue;
      this.#locations.set(this.#locationKey(projectionScope, elementId), {
        elementId,
        messageId,
        runId,
        projectionScope,
        lastUpdatedAt: now,
      });
    }
  }

  /**
   * Locate which message / bubble currently hosts this elementId.
   */
  locateElement(
    elementId: string,
    projectionScope = 'default',
  ): RenderedElementLocation | undefined {
    return this.#locations.get(this.#locationKey(projectionScope, elementId));
  }

  /**
   * Find target message if any element in the given list is already hosted in a previous message.
   */
  findTargetMessageForElements(
    elementIds: string[],
    projectionScope = 'default',
  ): string | undefined {
    for (const id of elementIds) {
      if (id === 'assistant-message') continue;
      const loc = this.locateElement(id, projectionScope);
      if (loc) {
        return loc.messageId;
      }
    }
    return undefined;
  }

  /**
   * Find a host using only stable, top-level card identities from a validated
   * projection. Nested implementation-detail IDs are not authorization to
   * mutate an older message.
   */
  findTargetMessageForProjection(
    spec: TracerSpec,
    projectionScope = 'default',
  ): string | undefined {
    return this.findTargetMessageForElements(
      this.#targetableElementIds(spec),
      projectionScope,
    );
  }

  /**
   * Register only the direct children of the projection root as targetable
   * identities. Descendants remain renderable but never acquire ownership.
   */
  registerMessageProjection(
    messageId: string,
    runId: string,
    spec: TracerSpec,
    projectionScope = 'default',
  ): void {
    this.registerMessageElements(
      messageId,
      runId,
      this.#targetableElementIds(spec),
      projectionScope,
    );
  }

  /**
   * Clear tracker when session is reset.
   */
  clearProjectionScope(projectionScope: string): void {
    for (const [key, location] of this.#locations) {
      if (location.projectionScope === projectionScope) {
        this.#locations.delete(key);
      }
    }
  }

  clear(): void {
    this.#locations.clear();
  }

  #locationKey(projectionScope: string, elementId: string): string {
    return `${projectionScope}\u0000${elementId}`;
  }

  #targetableElementIds(spec: TracerSpec): string[] {
    const root = spec.elements[spec.root];
    return root?.children.filter((elementId) => Boolean(spec.elements[elementId])) ?? [];
  }
}

export const defaultElementLocationTracker = new ElementLocationTracker();
