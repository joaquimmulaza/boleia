import { createClient } from '@supabase/supabase-js';
import { supabaseAuthOptions } from './supabaseAuthOptions';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseAuthOptions);
