// src/send.js
import { supabase } from './supabase/supabaseClient.js';
import { scrollDown,
        hideReplyContent,
        removeReply
        } from './updateMessage.js';

import { getReplyContext,
        removeReplyToContextFromCache
        } from './utils/cache.js';

// These will be set by main.js whenever a conversation is opened:
let currentConversationId = null;
let currentSessionUserId = null;
let currentOtherUserId = null;

/**
 * Call this from main.js each time you open/select a conversation.
 * 
 * @param {string|number} convoId      – the conversation_id from the "conversation" table
 * @param {string}       myUserId      – the current user's auth.users.id
 * @param {string}       otherUserId   – the other participant's auth.users.id (for direct chats). 
 */
export function setConversationContext(convoId, myUserId, otherUserId) {
    currentConversationId = convoId;
    currentSessionUserId = myUserId;
    currentOtherUserId = otherUserId;
    console.log(currentConversationId);
    console.log(currentSessionUserId);
    console.log(currentOtherUserId);
}

// Grab DOM elements once:
// (Make sure these exist in your HTML and aren't recreated later)
const messageInput = document.getElementById('message-typed');
const sendButton   = document.querySelector('#send-icon'); // supposedly a button

if (sendButton && messageInput) {
    sendButton.addEventListener('click',() => {
        send(currentSessionUserId, currentOtherUserId, currentConversationId);
    });
    messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(currentSessionUserId, currentOtherUserId, currentConversationId);
            messageInput.style.height = '40px';
        }
    });
} else {
    console.warn('send.js: .send-icon or #message-typed not found in DOM.');
}

export async function send(currentSessionUserId, currentOtherUserId, currentConversationId) {
    if (!currentConversationId) {
        alert('No conversation selected.');
        return;
    }

    const text = messageInput.value.trim();
    if (!text) return;
    const replyTo = messageInput.dataset.replyTo;
    const convoId = messageInput.dataset.convoId;

    try {
        const newMessage = {
            conversation_id: currentConversationId,
            from: currentSessionUserId,
            to: currentOtherUserId,
            contents: text
        };

        if (replyTo !== '' || getReplyContext() === null) {
            if (convoId !== '' && convoId == currentConversationId) {
                newMessage.reply_to = replyTo;
            } else {
                console.log("Cannot Reply, Wrong Conversation Id!");
            }
        }

        // Insert to the database
        const { data: newMessageInserted, error } = await supabase
            .from('message')
            .insert(newMessage)
            .select()
            .single();

        if (error) throw error;

        messageInput.value = '';
        
        // Broadcast to self, for instant UI update
        await supabase.channel(`user-${currentSessionUserId}`).send({
            type: 'broadcast',
            event: 'new-message',
            payload: {
                type: 'insert',
                message: newMessageInserted,
                convoId: currentConversationId
            }
        });

        // ✅ Broadcast to recipient's channel
        await supabase.channel(`user-${currentOtherUserId}`).send({
            type: 'broadcast',
            event: 'new-message',
            payload: {
                type: 'insert',
                message: newMessageInserted,
                convoId: currentConversationId
            }
        });

    } catch (sendError) {
        console.error('Error sending message:', sendError.message);
        alert('Failed to send message. Please try again.');
    }

    removeReplyToContextFromCache();
    removeReply();
    hideReplyContent();
    scrollDown();
}
