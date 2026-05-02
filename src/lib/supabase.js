import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ivsbjlcwhlvanhlxnqrz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2c2JqbGN3aGx2YW5obHhucXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDIyMjAsImV4cCI6MjA4NjUxODIyMH0.PHw7WFUl1rfNqP4M-9mhVwkaSVIvD2DdkmOLnlCyqlI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);