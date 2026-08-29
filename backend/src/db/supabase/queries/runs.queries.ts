import { supabase } from '../client.js';
import type { RunRow } from '../../../types/database.js';

export const runQueries = {
  async create(input: { operationId: string; agentName: string; triggerEvent?: string }): Promise<RunRow> {
    const { data, error } = await supabase
      .from('runs')
      .insert({
        operation_id: input.operationId,
        agent_name: input.agentName,
        flow_step: 'start',
        status: 'active',
        context_json: {},
        trigger_event: input.triggerEvent ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as RunRow;
  },

  async getById(runId: string): Promise<RunRow | null> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();
    if (error) return null;
    return data as unknown as RunRow;
  },

  async updateContext(runId: string, contextUpdate: Record<string, unknown>): Promise<void> {
    const current = await this.getById(runId);
    const merged = { ...(current?.context_json ?? {}), ...contextUpdate };
    const { error } = await supabase
      .from('runs')
      .update({ context_json: merged } as any)
      .eq('id', runId);
    if (error) throw error;
  },

  async updateStep(runId: string, flowStep: string, status?: RunRow['status']): Promise<void> {
    const { error } = await supabase
      .from('runs')
      .update({ flow_step: flowStep, ...(status ? { status } : {}) } as any)
      .eq('id', runId);
    if (error) throw error;
  },
};
