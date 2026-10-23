import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://jilvizwncfexlbsfowdx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbHZpenduY2ZleGxic2Zvd2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODEwNzQsImV4cCI6MjA5Mjk1NzA3NH0.-wGVyYW8MxaJiuMWadBva6n1EbDMDRW93IhgtMApuAU";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
