export interface RenderedElementLocation {
  elementId: string;
  messageId: string;
  runId: string;
  lastUpdatedAt: number;
}

export class ElementLocationTracker {
  readonly #locations = new Map<string, RenderedElementLocation>();
  readonly #elementsByMessage = new Map<string, Set<string>>();

  /**
   * Register all element IDs that live in a specific chat message / bubble.
   */
  registerMessageElements(
    messageId: string,
    runId: string,
    elementIds: string[],
  ): void {
    const now = Date.now();
    let messageSet = this.#elementsByMessage.get(messageId);
    if (!messageSet) {
      messageSet = new Set<string>();
      this.#elementsByMessage.set(messageId, messageSet);
    }

    for (const elementId of elementIds) {
      if (elementId === 'assistant-message') continue;
      this.#locations.set(elementId, {
        elementId,
        messageId,
        runId,
        lastUpdatedAt: now,
      });
      messageSet.add(elementId);
    }
  }

  /**
   * Locate which message / bubble currently hosts this elementId.
   */
  locateElement(elementId: string): RenderedElementLocation | undefined {
    return this.#locations.get(elementId);
  }

  /**
   * Find target message if any element in the given list is already hosted in a previous message.
   */
  findTargetMessageForElements(elementIds: string[]): string | undefined {
    for (const id of elementIds) {
      if (id === 'assistant-message') continue;
      const loc = this.#locations.get(id);
      if (loc) {
        return loc.messageId;
      }
    }
    return undefined;
  }

  /**
   * Clear tracker when session is reset.
   */
  clear(): void {
    this.#locations.clear();
    this.#elementsByMessage.clear();
  }
}

export const defaultElementLocationTracker = new ElementLocationTracker();
