import { supabase } from '../client.js';
import type { EventRow } from '../../../types/database.js';

export const eventQueries = {
  async create(
    input: Pick<EventRow, 'run_id' | 'operation_id' | 'severity' | 'category' | 'title' | 'message'>
  ): Promise<EventRow> {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...input, acknowledged: false } as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as EventRow;
  },

  async listByOperation(operationId: string): Promise<EventRow[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('operation_id', operationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as EventRow[];
  },
};
