import { createClient } from '@supabase/supabase-js';

// Access environment variables using import.meta.env provided by Vite.
// These variables must be prefixed with VITE_ to be exposed to the client-side.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Basic validation (optional but good practice)
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing from environment variables.');
    // You might want to display a user-friendly error or prevent the app from functioning.
}

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase client initialized (JS version) with URL:", supabaseUrl);
