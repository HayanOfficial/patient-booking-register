// ==============================================================================
// Serverless Function: Reset Staff Password (Admin Only)
// Runtime: Node.js (Vercel Serverless)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const { userId, newPassword, callerRole } = req.body || {};

  if (callerRole !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required.' });
  }

  if (!userId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Valid userId and password (>=6 chars) are required.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('dummy')) {
    return res.status(200).json({ success: true, message: 'Password reset in local mode' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await supabase.rpc('change_user_password', {
      p_user_id: userId,
      p_new_password: newPassword
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

