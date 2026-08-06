-- Create feedback table for user submissions
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (public submissions)
CREATE POLICY "Allow public insert" ON feedback
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow service role to read feedback (for admin)
CREATE POLICY "Allow service role read" ON feedback
  FOR SELECT
  TO service_role
  USING (true);
