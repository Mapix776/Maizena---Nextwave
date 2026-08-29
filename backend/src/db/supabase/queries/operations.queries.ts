import { supabase } from '../client.js';
import type { OperationRow } from '../../../types/database.js';

export const operationQueries = {
  async create(input: Pick<OperationRow, 'client_name' | 'reference_code'>): Promise<OperationRow> {
    const { data, error } = await supabase
      .from('operations')
      .insert({ ...input, status: 'active', canonical_data: {} })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as OperationRow;
  },

  async getById(id: string): Promise<OperationRow | null> {
    const { data, error } = await supabase
      .from('operations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as unknown as OperationRow;
  },

  async list(): Promise<OperationRow[]> {
    const { data, error } = await supabase
      .from('operations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as OperationRow[];
  },
};
