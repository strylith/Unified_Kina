import { supabase } from '../lib/supabaseClient.js';

export async function getAndMergeUserProfile(user) {
  try {
    if (!user || !user.id) return user;
    // Try public.profiles first (frontend default schema)
    let { data, error } = await supabase
      .from('profiles')
      .select('email, full_name, avatar_url, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    
    // If not found and user is from Google auth, try kina_v2.profiles
    // (though frontend typically uses public schema)
    if ((error || !data) && user.id) {
      // Note: Frontend client defaults to public schema; backend handles kina_v2
      // For now, rely on public.profiles which should be upserted by callback
    }
    
    if (error || !data) return user;
    const parts = (data.full_name || '').trim().split(/\s+/);
    const firstName = parts[0] || user.firstName || 'Guest';
    const lastName = parts.slice(1).join(' ') || user.lastName || '';
    return {
      ...user,
      firstName,
      lastName,
      email: data.email || user.email,
      avatar_url: data.avatar_url || user.avatar_url,
      member_since: user.member_since || data.updated_at
    };
  } catch {
    return user;
  }
}



