// ==============================================================================
// Serverless Function: Delete / Disable User (Admin Only)
// Runtime: Node.js (Vercel Serverless)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const { userId, callerRole } = req.body || {};

  if (callerRole !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required.' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('dummy')) {
    return res.status(200).json({ success: true, message: 'User deleted in local mode' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ deleted_at: new Date().toISOString(), status: 'disabled' })
      .eq('id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

