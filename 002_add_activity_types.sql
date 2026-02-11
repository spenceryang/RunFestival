-- RunFestival Migration: Add activity types and missing INSERT policy
-- Run: supabase db push

-- Add activity_types column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_types TEXT[] DEFAULT ARRAY['running'];

-- Add missing INSERT policy for users table
-- (001_initial_schema.sql has SELECT/UPDATE but not INSERT)
-- users.id must equal auth.uid() so users can only create their own profile row
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
