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
}

// Grab DOM elements once:
// (Make sure these exist in your HTML and aren't recreated later)
const messageInput = document.getElementById('message-typed');
const sendButton   = document.querySelector('.send-icon');

if (sendButton && messageInput) {
    sendButton.addEventListener('click',() => {
        send();
    });
    messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            send();
        }
    });
} else {
    console.warn('send.js: .send-icon or #message-typed not found in DOM.');
}

async function send() {
    // 1) Ensure we have a valid conversation ID
    if (!currentConversationId) {
        alert('No conversation selected.');
        return;
    }
    // 2) Read and trim the input
    const text = messageInput.value.trim();
    if (!text) { // nothing to send
        return;
    }
    // 3) Insert a new row into the "message" table
    try {
        await supabase
            .from('message')
            .insert({
            conversation_id: currentConversationId,
            from: currentSessionUserId,
            to:   currentOtherUserId,
            contents: text
            });

        // 4) Clear the input field
        messageInput.value = '';

        // 5) Optionally, you can reload the messages for this conversation.
        //    We assume main.js exposes a global function loadConversationMessages()
        //    – if it's declared in main.js at top‐level (window scope), you can call it here:
        if (typeof window.loadConversationMessages === 'function') {
            window.loadConversationMessages(currentConversationId);
        }
    } catch (sendError) {
        console.error('Error sending message:', sendError.message);
        alert('Failed to send message. Please try again.');
    }
}
