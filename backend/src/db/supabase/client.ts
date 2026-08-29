import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';

import WebSocket from 'ws';
(globalThis as any).WebSocket = WebSocket;

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
