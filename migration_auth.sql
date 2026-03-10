-- SQL Migration for Supabase Auth & Multi-Tenancy
-- Run this in the Supabase SQL Editor

-- 1. Create owner_id columns
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- 3. Define Access Policies
-- Owners can only see/edit their own data
CREATE POLICY "Owners manage their properties" ON public.properties FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owners manage their cleaners" ON public.cleaners FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owners manage their checklist" ON public.checklist_items FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owners manage their tasks" ON public.cleaning_tasks FOR ALL USING (auth.uid() = owner_id);

-- Cleaners need public access via task ID to view/update without login
CREATE POLICY "Public select for tasks" ON public.cleaning_tasks FOR SELECT USING (true);
CREATE POLICY "Public update for tasks" ON public.cleaning_tasks FOR UPDATE USING (true);
