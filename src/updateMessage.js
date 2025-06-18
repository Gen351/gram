import { supabase } from "./supabase/supabaseClient";

export async function toggleLikeMessage(msgId) {
    const { data, error: fetchError } = await supabase
        .from('message')
        .select('liked')
        .eq('id', msgId)
        .single();

    if (fetchError || !data) {
        console.error('Failed to fetch liked state:', fetchError);
        return;
    }

    const opp = (data.liked === 'liked') ? 'empty' : 'liked';

    const { error: updateError } = await supabase
        .from('message')
        .update({ liked: opp })
        .eq('id', msgId);

    if (updateError) {
        console.error('Failed to update liked state:', updateError);
    } else {
        console.log(`Updated liked state to '${opp}' for message ID: ${msgId}`);
    }
}