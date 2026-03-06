import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  // Use a simple device-based key (or Clerk userId if available via header)
  const userId = req.headers['x-user-id'] || req.query.userId || 'anonymous';

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('vault_characters')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');

      if (error) throw error;

      // Map DB columns to camelCase for frontend compatibility
      const characters = (data || []).map(mapCharacter);
      return res.json({ characters });
    }

    if (req.method === 'POST') {
      const { name, photoUrl, thumbnailUrl } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('vault_characters')
        .insert({
          user_id: userId,
          name,
          photo_url: photoUrl || null,
          thumbnail_url: thumbnailUrl || null,
        })
        .select()
        .single();

      if (error) throw error;

      return res.json({ character: mapCharacter(data) });
    }

    if (req.method === 'DELETE') {
      const { characterId } = req.body || req.query;
      if (!characterId) return res.status(400).json({ error: 'characterId required' });

      const { error } = await supabaseAdmin
        .from('vault_characters')
        .delete()
        .eq('id', characterId)
        .eq('user_id', userId);

      if (error) throw error;

      return res.json({ deleted: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('vault error:', err);
    res.status(500).json({ error: err.message });
  }
}

function mapCharacter(row) {
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photo_url,
    thumbnailUrl: row.thumbnail_url,
    createdAt: row.created_at,
  };
}
