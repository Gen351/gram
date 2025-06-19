// src/send.js
import { supabase } from './supabase/supabaseClient.js';


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
        send(currentSessionUserId, currentOtherUserId, currentConversationId, messageInput);
    });
    messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(currentSessionUserId, currentOtherUserId, currentConversationId, messageInput);
            messageInput.style.height = '40px';
        }
    });
} else {
    console.warn('send.js: .send-icon or #message-typed not found in DOM.');
}

export async function send(currentSessionUserId, currentOtherUserId, currentConversationId, messageInput) {
    // 1) Ensure we have a valid conversation ID
    if (!currentConversationId) {
        alert('No conversation selected.');
        return;
    }

    // 2) Read and trim the input
    const text = messageInput.value.trim();
    if (!text) return;

    // 3) Insert a new row into the "message" table
    try {
        const { data, error } = await supabase
            .from('message')
            .insert({
                conversation_id: currentConversationId,
                from: currentSessionUserId,
                to: currentOtherUserId,
                contents: text
            })
            .select()
            .single();

        if (error) throw error;

        // 4) Clear the input field
        messageInput.value = '';

    } catch (sendError) {
        console.error('Error sending message:', sendError.message);
        alert('Failed to send message. Please try again.');
    }
}
