import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a real client if configured, otherwise a stub that returns empty results
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createSupabaseStub();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

function createSupabaseStub() {
  const emptyResult = { data: null, error: null };
  const emptyQuery = {
    select: () => emptyQuery,
    eq: () => emptyQuery,
    is: () => emptyQuery,
    order: () => emptyQuery,
    single: () => Promise.resolve(emptyResult),
    then: (resolve) => resolve(emptyResult),
  };
  return {
    from: () => ({
      select: () => emptyQuery,
      insert: () => Promise.resolve(emptyResult),
      update: () => ({ eq: () => Promise.resolve(emptyResult) }),
      delete: () => ({ eq: () => Promise.resolve(emptyResult) }),
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve(emptyResult),
        getPublicUrl: () => ({ data: { publicUrl: null } }),
      }),
    },
    rpc: () => Promise.resolve(emptyResult),
  };
}
