import { supabase } from "./supabase/supabaseClient";
import { fetchConversationType,
        toggleLike,
        setMessageToDeleted
        } from './supabase/queryFunctions.js';


const messageArea = document.querySelector('.message-area');

const likedMessageStyle = '2px dashed red';

export async function updateMessage(message, date = "") {
    const messageElement = document.querySelector(`[data-msg-id="${message.id}"]`);
    if (!messageElement) return;

    if(message.deleted === true) {
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">-- message deleted --</div>
                <div class="message-timestamp">
                    ${date}
                    <pre><br></pre>
                </div>
            </div>
        `;
        messageElement.querySelector('.message-content').classList.add('deleted');
    }

    // Update border on message content
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv) {
        if (message.liked === 'liked') {
            contentDiv.style.border = likedMessageStyle;
        } else {
            contentDiv.style.border = 'none';
        }
    }

    // Update like button color
    const likeBtn = messageElement.querySelector('#message-like-btn');
    if (likeBtn) {
        likeBtn.innerHTML = message.liked == 'liked' ? '<i class="fi fi-sr-heart"></i>' : '<i class="fi fi-br-heart"></i>';
        likeBtn.style.color = message.liked === 'liked' ? 'red' : '';
    }
}


export async function appendLatestMessage(message, currentSessionUserId, currentConvoId) {
    if(!messageArea) { return; }
    if(currentConvoId && message.conversation_id != currentConvoId) { 
        console.warn("Not the correct conversation!");
        return; 
    }

    if(message.from == currentSessionUserId || message.to == currentSessionUserId) {
        fetchConversationType(message.conversation_id);
        await loadMessage(message, currentSessionUserId, message.conversation_id);
        setLatestMessage(message.contents, message.conversation_id);
        scrollDown();
    }
}


export async function loadMessage(message, currentSessionUserId, currentConvoId, conversation_type = 'direct') {
    // --- Start: Modify the PREVIOUS message ---
    if(currentConvoId && currentConvoId != message.conversation_id) { return; }
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
    const senderName = (message.profile_from?.username || '');
    const isSenderNameHidden = (conversation_type == 'direct') ? 'style="display: none;"' : '';

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

    if(message.deleted === true) {
        messageElement.innerHTML += `
            <div class="message-bubble">
                <div class="message-content">-- message deleted --</div>
                <div class="message-timestamp">
                    ${date}
                    <pre><br></pre>
                </div>
            </div>
        `;
        messageElement.querySelector('.message-content').classList.add('deleted');
    } else {
        const highlightIfLiked = message.liked == 'liked' ? 'style="border:' + likedMessageStyle + ';"' : '';
        
        messageElement.innerHTML += `
            <div class="message-bubble">
                ${replyHTML}
                <div class="message-sender" ${isSenderNameHidden}>${senderName}</div>
                <div class="message-content" ${highlightIfLiked}>${message.deleted === true ? `message deleted` : message.contents}</div>
                <div class="message-timestamp">
                    ${date}
                    <pre><br></pre>
                </div>
            </div>
    
            <div class="message-menu">
                <button id="message-like-btn" data-msg-id="${message.id}" style="${message.liked == 'liked' ? 'color: red;' : ''}">${message.liked == 'liked' ? '<i class="fi fi-sr-heart"></i>' : '<i class="fi fi-br-heart"></i>'}</button>
                <button id="message-reply-btn" data-msg-id="${message.id}"><i class="fi fi-sr-undo"></i></button>
                ${isSentByCurrentUser ? `<button id="message-delete-btn" data-msg-id="${message.id}"><i class="fi fi-br-cross-circle"></i></button>` 
                : ``}
            </div>
        `;

        const likeBtn = messageElement.querySelector('#message-like-btn');
        if (likeBtn) { 
            likeBtn.addEventListener('click', () => {
                toggleLike(message.id);
            });
        }
        const replyBtn = messageElement.querySelector('#message-reply-btn');
        if(replyBtn) {
            replyBtn.addEventListener('click', () => {
                showReplyContent();
                setReplyToId(message.id, message.contents);
                document.getElementById("message-typed").focus();
            });
        }
        const deleteBtn = messageElement.querySelector('#message-delete-btn');
        if(deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const confirmDelete = window.confirm('Delete "' + message.contents + '" ?');
                if (confirmDelete) {
                    setMessageToDeleted(message.id);
                    updateMessage(message, date);
                }
            });
        }
    }


    messageArea.appendChild(messageElement);
}

export async function showReplyContent() {
    const replyBtnIcons = document.querySelectorAll('#message-reply-btn');
    if (!replyBtnIcons) return;
    replyBtnIcons.forEach(rplyBtn => {rplyBtn.style.display = 'none';});
}

export async function hideReplyContent() {
    const replyBtnIcons = document.querySelectorAll('#message-reply-btn');
    if (!replyBtnIcons) return;
    replyBtnIcons.forEach(rplyBtn => {rplyBtn.style.display = 'flex';});
}

// when clicking the reply button, set the reply to according to the data in that reply button
async function setReplyToId(msgId, msgContents) { 
    document.getElementById('message-typed').dataset.replyTo = msgId;

    const preview = document.querySelector('.reply-preview-area');
    preview.classList.add('visible');
    preview.querySelector('.reply-preview-content').innerHTML = msgContents;
}
export async function removeReply() {
    document.getElementById('message-typed').dataset.replyTo = "";
    const preview = document.querySelector('.reply-preview-area');
    preview.classList.remove('visible');
    preview.querySelector('.reply-preview-content').innerHTML = "";
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

export async function scrollAtBottom() {
    const scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn");
    const messageArea = document.querySelector(".message-area");
    const atBottom = messageArea.scrollTop + messageArea.clientHeight >= messageArea.scrollHeight - 10;
    if (!atBottom) { scrollToBottomBtn.style.display = "block"; }
    else { scrollToBottomBtn.style.display = "none"; }
}

export async function scrollDown() {
    const messageArea = document.querySelector(".message-area");
    messageArea.scrollTop = messageArea.scrollHeight;
}

export async function setLatestMessage(msgContents, conversationId) {
    document.querySelector(`[data-chat-id="${conversationId}"]`)
        .querySelector('.last-message')
            .innerHTML = msgContents;
}