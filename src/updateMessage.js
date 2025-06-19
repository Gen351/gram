import { supabase } from "./supabase/supabaseClient";

const messageArea = document.querySelector('.message-area');



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
    const opp = (data.liked == 'liked') ? "empty" : "liked";

    const { error: updateError } = await supabase
        .from('message')
        .update({ liked: opp })
        .eq('id', msgId);

    if (updateError) { console.error('Failed to update liked state:', updateError); }
}


export async function updateMessage(message) {
    const messageElement = document.querySelector(`[data-msg-id="${message.id}"]`);
    if (!messageElement) return;

    // Update border on message content
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv) {
        if (message.liked === 'liked') {
            contentDiv.style.border = '2px dashed red';
        } else {
            contentDiv.style.border = 'none';
        }
    }

    // Update like button color
    const likeBtn = messageElement.querySelector('#message-like-btn');
    if (likeBtn) {
        likeBtn.style.color = message.liked === 'liked' ? 'red' : '';
    }
}


export async function appendLatestMessage(message, currentSessionUserId, currentConvoId) {
    if(!messageArea) { return; }
    if(message.conversation_id != currentConvoId) {
        return;
    }
    if(message.from == currentSessionUserId || message.to == currentSessionUserId) {
        loadMessage(message, currentSessionUserId);
        messageArea.scrollTop = messageArea.scrollHeight;
    }
}


export async function loadMessage(message, currentSessionUserId, message_type = 'direct') {
    // --- Start: Modify the PREVIOUS message ---
    
    // Get the last message element that was already added to the message area
    const lastMessageElement = messageArea.lastElementChild;

    // Check if a previous message exists and has a timestamp
    if (lastMessageElement && lastMessageElement.dataset.timestamp) {
        const lastMessageTimestamp = lastMessageElement.dataset.timestamp;

        const currentMessageTime = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const lastMessageTime = new Date(lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // If the new message belongs to the same time group as the last one...
        if (currentMessageTime === lastMessageTime) {
            // ...find the timestamp on the LAST message and hide it.
            const lastTimestampElement = lastMessageElement.querySelector('.message-timestamp');
            if (lastTimestampElement) {
                lastTimestampElement.style.display = 'none';
                
                // Also remove its indent if it had one
                const preElement = lastTimestampElement.querySelector('pre');
                if (preElement) { preElement.style.display = 'none'; }
            }
        }
    }
    // --- End: Modify the PREVIOUS message ---

    // Now, create the NEW message. Its timestamp will be visible by default.
    const messageElement = document.createElement('div');
    messageElement.dataset.timestamp = message.created_at; // Crucial for the *next* message
    messageElement.dataset.msgId = message.id; // for querying the message
    const isSentByCurrentUser = message.from === currentSessionUserId;
    messageElement.classList.add('message', isSentByCurrentUser ? 'outgoing' : 'incoming');
    const senderName = (message.profile_from?.username || 'Unknown User');
    const isSenderNameHidden = (message_type == 'direct') ? 'style="display: none;"' : '';

    // The new message's timestamp is ALWAYS visible initially.
    const msgDate = new Date(message.created_at);
    const now = new Date();
    // Check if it's the same day
    const isToday = msgDate.toDateString() === now.toDateString();
    const date = isToday
        ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : msgDate.toLocaleString([], { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
            });
    
    let replyHTML = '';

    // 2. If a reply exists, fetch it and build the reply HTML.
    if (message.reply_to != null) {
        const replied_message = await getMessage(message.reply_to);
        if (replied_message) {
            const repliedPreview = replied_message.contents.slice(0, 100); // trim preview

            // Populate the variable instead of adding directly to the element
            replyHTML = `
                <div class="message-reply-preview">
                    <div class="reply-bar"></div>
                    <div class="reply-content">
                        <div class="reply-text">${repliedPreview}</div>
                    </div>
                </div>
            `;
        }
    }

    const highlightIfLiked = message.liked == 'liked' ? "style='border: 2px dashed red;'" : '';

    messageElement.innerHTML += `
        <div class="message-bubble">
            ${replyHTML}
            <div class="message-sender" ${isSenderNameHidden}>${senderName}</div>
            <div class="message-content" ${highlightIfLiked}>${message.contents}</div>
            <div class="message-timestamp">
                ${date}
                <pre><br></pre>
            </div>
        </div>

        <div class="message-menu">
            <button id="message-like-btn" data-msg-id="${message.id}" style="${message.liked == 'liked' ? 'color: red;' : ''}"><i class="fi fi-br-heart"></i></button>
            <button id="message-reply-btn" data-msg-id="${message.id}"><i class="fi fi-br-paper-plane-launch"></i></button>
            ${isSentByCurrentUser ? `<button id="message-delete-btn" data-msg-id="${message.id}"><i class="fi fi-br-cross-circle"></i></button>` 
            : ``}
        </div>
    `;
    
    messageArea.appendChild(messageElement);
    
    const likeBtn = messageElement.querySelector('#message-like-btn');
    if (likeBtn) { likeBtn.addEventListener('click', () => toggleLikeMessage(message.id)); }
    const replyBtn = messageElement.querySelector('#message-reply-btn');
    if(replyBtn) {
        replyBtn.addEventListener('click', () => {

        });
    }
}

async function toggleLikeButtonFunction() {
    const likeBtnIcon = document.querySelector('#like-icon');
    if(!likeBtnIcon) { return; }


}


async function getMessage(msgId) {
    try {
        const { data:message, error } = await supabase
            .from('message')
            .select('*')
            .eq('id', msgId)
            .single();

        return message;
    } catch (error) {
        console.error('Error fetching message: ', error);
        return null;
    }
}