import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cddrofolxfxizmxxjbua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZHJvZm9seGZ4aXpteHhqYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDg0MzksImV4cCI6MjA4ODU4NDQzOX0.2rXovAlPQ5dkXJX7TrIPzwLCP5K47TwNWqR1TdftaEo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log('Fetching properties...');
    const { data: properties, error: propertiesError } = await supabase.from('properties').select('*').limit(1);
    console.log('Properties Sample:', properties ? properties[0] : 'No data');

    console.log('\nFetching cleaning_tasks...');
    const { data: tasks, error: tasksError } = await supabase.from('cleaning_tasks').select('*').limit(1);
    console.log('Tasks Sample:', tasks ? tasks[0] : 'No data');
}

check();
