import { supabase } from '../client.js';
import type { DecisionRow } from '../../../types/database.js';

export const decisionQueries = {
  async create(
    input: Pick<DecisionRow, 'run_id' | 'operation_id' | 'action_type' | 'title' | 'severity' | 'execution_mode' | 'question' | 'options_json'>
  ): Promise<DecisionRow> {
    const { data, error } = await supabase
      .from('decisions')
      .insert({ ...input, status: 'pending' } as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as DecisionRow;
  },

  async resolve(decisionId: string, answer: string): Promise<DecisionRow> {
    const { data, error } = await supabase
      .from('decisions')
      .update({ answer, status: 'resolved', resolved_at: new Date().toISOString() } as any)
      .eq('id', decisionId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as DecisionRow;
  },

  async listPendingByRun(runId: string): Promise<DecisionRow[]> {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .eq('run_id', runId)
      .eq('status', 'pending');
    if (error) throw error;
    return (data ?? []) as unknown as DecisionRow[];
  },
};
