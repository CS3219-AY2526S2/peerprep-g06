import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'User service is running' });
});

// Create user profile
app.post('/users', async (req, res) => {
  try {
    const { id, email, display_name } = req.body;

    if (!id || !email) {
      return res.status(400).json({ error: 'Missing required fields: id, email' });
    }

    // Insert into profiles table
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          id,
          email,
          display_name,
        },
      ])
      .select();

    if (error) {
      console.error('Error creating profile:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
