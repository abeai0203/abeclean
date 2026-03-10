import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cddrofolxfxizmxxjbua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZHJvZm9seGZ4aXpteHhqYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDg0MzksImV4cCI6MjA4ODU4NDQzOX0.2rXovAlPQ5dkXJX7TrIPzwLCP5K47TwNWqR1TdftaEo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log('Checking database table status...');

    const { data: cleaners, error: cleanersError } = await supabase.from('cleaners').select('*').limit(1);
    if (cleanersError) {
        console.error('Cleaners table error:', cleanersError.message);
    } else {
        console.log('Cleaners table EXISTS!');
    }

    const { data: properties, error: propertiesError } = await supabase.from('properties').select('id').limit(1);
    if (propertiesError) {
        console.error('Properties table error:', propertiesError.message);
    } else if (properties && properties.length > 0) {
        console.log('Properties table ID type:', typeof properties[0].id, properties[0].id);
    } else {
        console.log('Properties table exists but is empty.');
    }

    const { data: tasks, error: taskError } = await supabase.from('cleaning_tasks').select('*').limit(1);
    if (taskError) {
        console.error('Cleaning tasks table error:', taskError.message);
    } else {
        console.log('Cleaning tasks table EXISTS!');
    }
}

check();
