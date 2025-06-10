import { supabase } from './supabase/supabaseClient.js';



export async function changeUsername(newUsername, userAuthId) {
    const { data, error } = await supabase
        .from('profile')
        .update({ username: newUsername })
        .eq('auth_id', (await supabase.auth.getUser()).data.user.id)
        .select()
        .single();
        
    if(error) {
        console.error('Failed to update username:', error.message);
        return null;
    }
    
    return data;
}