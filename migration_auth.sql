-- 1. ADD OWNER_ID COLUMNS
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE cleaning_tasks ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 2. ENABLE RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- 3. CREATE POLICIES (Data Isolation)
-- Properties
CREATE POLICY "Users can manage their own properties" ON properties
    FOR ALL USING (auth.uid() = owner_id);

-- Cleaners
CREATE POLICY "Users can manage their own cleaners" ON cleaners
    FOR ALL USING (auth.uid() = owner_id);

-- Checklist Items
CREATE POLICY "Users can manage their own checklist items" ON checklist_items
    FOR ALL USING (auth.uid() = owner_id);

-- Cleaning Tasks (Owner access)
CREATE POLICY "Owners can manage their own tasks" ON cleaning_tasks
    FOR ALL USING (auth.uid() = owner_id);

-- Cleaning Tasks (Public access for cleaners using task ID)
-- Note: This allows cleaners to fetch and update details without logging in
CREATE POLICY "Public select for tasks" ON cleaning_tasks FOR SELECT USING (true);
CREATE POLICY "Public update for tasks" ON cleaning_tasks FOR UPDATE USING (true);
