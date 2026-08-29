import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';
import type { Database } from '../../types/supabase.types.js'; // Generaremos este archivo luego si usamos Supabase CLI, o usamos tipos manuales

import WebSocket from 'ws';
(globalThis as any).WebSocket = WebSocket;

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      WebSocket: WebSocket as any,
    }
  }
);
