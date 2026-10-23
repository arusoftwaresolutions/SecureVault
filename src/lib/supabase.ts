import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jilvizwncfexlbsfowdx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbHZpenduY2ZleGxic2Zvd2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODEwNzQsImV4cCI6MjA5Mjk1NzA3NH0.-wGVyYW8MxaJiuMWadBva6n1EbDMDRW93IhgtMApuAU';

// Export configuration status to allow UI to handle missing credentials
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Initialize Supabase client.
 * We use placeholders if variables are missing to prevent the app from crashing at the top-level.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);