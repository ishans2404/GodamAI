-- GodamAI Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'operator' CHECK (role IN ('admin','manager','operator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  width_m DECIMAL(10,2) NOT NULL,
  depth_m DECIMAL(10,2) NOT NULL,
  height_m DECIMAL(10,2) NOT NULL,
  address TEXT,
  total_capacity_m3 DECIMAL(12,3),
  owner_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zones / Racks within warehouse
CREATE TABLE IF NOT EXISTS zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone_type TEXT DEFAULT 'rack' CHECK (zone_type IN ('rack','shelf','floor','cold','hazmat','bulk')),
  x_pos DECIMAL(10,3) NOT NULL DEFAULT 0,
  y_pos DECIMAL(10,3) NOT NULL DEFAULT 0,
  z_pos DECIMAL(10,3) NOT NULL DEFAULT 0,
  width_m DECIMAL(10,3) NOT NULL,
  depth_m DECIMAL(10,3) NOT NULL,
  height_m DECIMAL(10,3) NOT NULL,
  max_weight_kg DECIMAL(10,2),
  temperature_controlled BOOLEAN DEFAULT FALSE,
  near_exit BOOLEAN DEFAULT FALSE,
  capacity_m3 DECIMAL(12,3),
  utilized_m3 DECIMAL(12,3) DEFAULT 0,
  color TEXT DEFAULT '#1f7a8c',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  width_m DECIMAL(10,3) NOT NULL,
  depth_m DECIMAL(10,3) NOT NULL,
  height_m DECIMAL(10,3) NOT NULL,
  weight_kg DECIMAL(10,3),
  quantity INTEGER DEFAULT 1,
  fragile BOOLEAN DEFAULT FALSE,
  stackable BOOLEAN DEFAULT TRUE,
  hazardous BOOLEAN DEFAULT FALSE,
  temperature_sensitive BOOLEAN DEFAULT FALSE,
  retrieval_frequency TEXT DEFAULT 'medium' CHECK (retrieval_frequency IN ('low','medium','high')),
  image_url TEXT,
  ai_category TEXT,
  ai_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item Placements (result of optimization)
CREATE TABLE IF NOT EXISTS placements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  optimization_run_id UUID,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  x_pos DECIMAL(10,3),
  y_pos DECIMAL(10,3),
  z_pos DECIMAL(10,3),
  quantity_placed INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimization Runs
CREATE TABLE IF NOT EXISTS optimization_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  space_utilization_pct DECIMAL(5,2),
  items_placed INTEGER DEFAULT 0,
  items_unplaced INTEGER DEFAULT 0,
  optimization_score DECIMAL(5,2),
  ai_recommendations JSONB,
  run_time_ms INTEGER,
  algorithm TEXT DEFAULT 'greedy_3d_bin_pack',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;

-- Policies (permissive for authenticated users)
CREATE POLICY "Authenticated users can read all" ON warehouses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert" ON warehouses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON warehouses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON warehouses FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read all" ON zones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert" ON zones FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON zones FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON zones FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read all" ON inventory_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert" ON inventory_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON inventory_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON inventory_items FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read all" ON placements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert" ON placements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON placements FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON placements FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read all" ON optimization_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert" ON optimization_runs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON optimization_runs FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed demo data (run after creating the admin user)
-- NOTE: Replace 'YOUR_USER_ID' with actual user UUID after signup
