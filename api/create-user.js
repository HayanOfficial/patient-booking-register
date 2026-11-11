// ==============================================================================
// Serverless Function: Create User (Admin Only)
// Runtime: Node.js (Vercel Serverless)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const { fullName, username, role, email, password, callerRole } = req.body || {};

  // Verify caller is admin
  if (callerRole !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required.' });
  }

  if (!fullName || !username) {
    return res.status(400).json({ error: 'Full name and username are required.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('dummy')) {
    // Return mock response for local development
    return res.status(200).json({
      success: true,
      user: {
        id: `u-${Date.now()}`,
        full_name: fullName,
        username,
        role: role || 'operator',
        email: email || null,
        status: 'active',
        must_change_password: true,
      }
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data, error } = await supabase.from('user_profiles').insert([{
      full_name: fullName,
      username: username.toLowerCase().trim(),
      role: role || 'operator',
      email: email ? email.toLowerCase().trim() : null,
      status: 'active',
      must_change_password: true,
    }]).select().single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (password) {
      await supabase.rpc('change_user_password', {
        p_user_id: data.id,
        p_new_password: password
      });
    }

    return res.status(200).json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

