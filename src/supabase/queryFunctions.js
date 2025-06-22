import { supabase } from './supabaseClient.js';

export async function fetchProfile(userId) {
    const { data, error } = await supabase
        .from('profile')
        .select('id, username, bio')
        .eq('auth_id', userId)
        .single();
    return data ?? error;
}

export async function createProfile(userId, userEmail) {
    const { data, error } = await supabase
        .from('profile')
        .insert([{
            auth_id: userId,
            username: userEmail.split('@')[0] || 'New User'
        }])
        .select('id, username, bio')
        .single();
    if (error) throw error;
    return data;
}

export async function fetchConversationIds(userId) {
  const { data: participations, error } = await supabase
    .from('conversation_participant')
    .select('conversation_id')
    .eq('participant', userId);

  if (error) throw error;

  return participations.map(p => p.conversation_id);
}

export async function fetchConversationData(conversationIds) {
  const { data, error } = await supabase
    .from('conversation')
    .select('*')
    .in('id', conversationIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function fetchRecentMessages(conversationID, count = 1) {
    try {
        const { data, error } = await supabase
            .from('message')
            .select('*')
            .eq('conversation_id', conversationID)
            .order('id', { ascending: false })
            .limit(count);

        if (error || !data) {
            console.error("Error fetching messages:", error);
            return [];
        }

        return data;

    } catch (fetchError) {
        console.error("Error in fetchRecentMessages:", fetchError.message);
        return [];
    }
}

export async function fetchConversationParticipantUsername(conversationID, currentUserId) {
    try {
        const { data, error } = await supabase
            .from('conversation_participant')
            .select('participant')
            .eq('conversation_id', conversationID);

        if (error || !data) {
            console.error("Error fetching participants:", error);
            return null;
        }

        // Get the ID of the other participant
        const other = data.find(p => p.participant !== currentUserId);
        const otherParticipantId = other?.participant;

        if (!otherParticipantId) return null;

        const { data: profileData, error: err } = await supabase
            .from('profile')
            .select('username')
            .eq('auth_id', otherParticipantId)
            .single();

        if (err || !profileData) {
            console.error("Error fetching username:", err);
            return null;
        }

        return profileData.username;

    } catch (fetchError) {
        console.error('Error:', fetchError.message);
        return null;
    }
}

export async function fetchConversationType(conversationId) {
    const { data: type, error } = await supabase
        .from('conversation')
        .select('type')
        .eq('id', conversationId)
        .single();

    if(error) {
        console.error("Error fetching messages:", error.message);
        return 'direct';
    }
    return type;
}

export async function fetchConversationParticipants(conversationId) {
    const { data: participants } = await supabase
        .from('conversation_participant')
        .select('participant')
        .eq('conversation_id', conversationId);

    return participants;
}

export async function fetchMessages(conversationId) {
    const { data: messages, error } = await supabase
        .from('message')
        .select('*')
        .eq('conversation_id', conversationId) // Updated field name
        .order('id', { ascending: true });

    if (error) {
        console.error("Error fetching messages:", error.message);
        document.querySelector('.message-area').innerHTML = '<p>Error loading messages.</p>';
        return;
    }

    return messages;
}

export async function toggleLike(msgId) {
    const { data, error: fetchError } = await supabase
        .from('message')
        .select('liked')
        .eq('id', msgId)
        .single();

    if (fetchError || !data) {
        console.error('Failed to fetch liked state:', fetchError);
        return;
    }
    const opp = (data.liked == 'liked') ? 'empty' : 'liked';

    const { error: updateError } = await supabase
        .from('message')
        .update({ liked: opp })
        .eq('id', msgId);

    if (updateError) { 
        console.error('Failed to update liked state:', updateError);
    }
}

export async function setMessageToDeleted(msgId) {
    const { error: updateError } = await supabase
        .from('message')
        .update({ deleted: true })
        .eq('id', msgId);

     if (updateError) { console.error('Failed to delete the message', updateError); }
}
