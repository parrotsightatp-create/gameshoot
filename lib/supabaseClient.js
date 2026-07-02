import { createClient } from '@supabase/supabase-js';

// anon public 密钥是设计给前端公开使用的，可以安全地写在这里
// 千万不要把 service_role 密钥放在这个文件或任何前端代码里
const SUPABASE_URL = 'https://kbdcgvnpvlgzuspfgvyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZGNndm5wdmxnenVzcGZndnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDkzOTYsImV4cCI6MjA5ODU4NTM5Nn0.FhvgFjlhhqfBb209pmBVXxy43wL2kdNewBrCMFSTCis';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
