-- Run this in Supabase SQL Editor to allow easy user deletion
-- (This will delete all linked properties/cleaners when a user is deleted)

-- 1. Remove old constraints
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_owner_id_fkey;
ALTER TABLE public.cleaners DROP CONSTRAINT IF EXISTS cleaners_owner_id_fkey;
ALTER TABLE public.cleaning_tasks DROP CONSTRAINT IF EXISTS cleaning_tasks_owner_id_fkey;
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_owner_id_fkey;

-- 2. Add new constraints with CASCADE
ALTER TABLE public.properties 
    ADD CONSTRAINT properties_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.cleaners 
    ADD CONSTRAINT cleaners_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.cleaning_tasks 
    ADD CONSTRAINT cleaning_tasks_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.checklist_items 
    ADD CONSTRAINT checklist_items_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
