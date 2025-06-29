import {toggleLike,
        setMessageToDeleted
        } from './supabase/queryFunctions.js';

import { cacheLikedMessage,
        cacheUnlikedMessage,
        cacheDeletedMessage,
        setReplyToContextFromCache,
        removeReplyToContextFromCache
        } from './utils/cache.js';

const messageArea = document.querySelector('.message-area');

const likedMessageStyle = '2px dashed red';

export async function updateMessage(message, date = ""/* magamit siguro sunod */) {
    const messageElement = document.querySelector(`.message[data-msg-id="${message.id}"]`);
    if (!messageElement) return;

    if(message.deleted) {
        const replyTexts = document.querySelectorAll(`.reply-text[data-msg-id="${message.id}"]`);
        if(replyTexts) {
            replyTexts.forEach(replyElement => {
                replyElement.classList.add('deleted');
                replyElement.innerHTML = `-- message deleted --`;
            });
        }

        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">-- message deleted --</div>
                <div class="message-timestamp">
                </div>
            </div>
        `;
        messageElement.querySelector('.message-content').classList.add('deleted');
        return;
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
    if(!messageArea) return;
    if(!currentConvoId || message.conversation_id != currentConvoId) return;
    if(message.from == currentSessionUserId || message.to == currentSessionUserId) {
        // fetchConversationType(message.conversation_id);
        await loadMessage(message, currentSessionUserId, message.conversation_id);
        
        const messageElement = document.querySelector(`.message[data-msg-id="${message.id}"]`);
        if (messageElement) {
            messageElement.classList.add('new');
            scrollDown();
            setTimeout(() => {
                messageElement.classList.remove('new');
            }, 3000);
        }
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
    messageElement.dataset.convoId = message.conversation_id; // for purging messages that don't belong to the conversation
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
        const replied_message_element = document.querySelector(`.message[data-msg-id="${message.reply_to}"]`);
        const message_deleted = replied_message_element.classList.contains('deleted');
        if (replied_message_element) {
            const repliedPreview = replied_message_element.querySelector(`.message-content`).innerHTML.slice(0, 100); // trim preview

            // Populate the variable instead of adding directly to the element
            replyHTML = `
                <div class="message-reply-preview">
                    <div class="reply-bar"></div>
                    <div class="reply-content">
                        <div class="reply-text ${message_deleted ? 'deleted' : ''}" data-msg-id="${replied_message_element.dataset.msgId}">${message_deleted ? '-- message deleted --' : repliedPreview}</div>
                    </div>
                </div>
            `;
        }
    }

    messageArea.appendChild(messageElement);

    if(message.deleted) {
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">-- message deleted --</div>
                <div class="message-timestamp">
                </div>
            </div>
        `;
        messageElement.querySelector('.message-content').classList.add('deleted');
    } else {
        const addLikedClass = message.liked == 'liked' ? 'liked' : '';
        
        messageElement.innerHTML += `
            <div class="message-bubble">
                ${replyHTML}
                <div class="message-sender" ${isSenderNameHidden}>${senderName}</div>
                <div class="message-content ${addLikedClass}">${message.deleted ? `--message deleted--` : message.contents}</div>
                <div class="message-timestamp">
                    ${date}
                    <pre><br></pre>
                </div>
            </div>
    
            <div class="message-menu">
                <button id="message-like-btn" data-msg-id="${message.id}" style="${message.liked == 'liked' ? 'color: red;' : ''}">${message.liked == 'liked' ? '<i class="fi fi-sr-heart"></i>' : '<i class="fi fi-br-heart"></i>'}</button>
                <button id="message-reply-btn" data-msg-id="${message.id}"><i class="fi fi-sr-undo"></i></button>
                ${isSentByCurrentUser ? `<button id="message-delete-btn" data-msg-id="${message.id}"><i class="fi fi-sr-trash"></i> </button>` 
                : ``}
            </div>
        `;
        // the message menu 's event listeners
        const likeBtn = messageElement.querySelector('#message-like-btn');
        if (!likeBtn) return;

        likeBtn.addEventListener('click', async () => {
            const msgContent = messageElement.querySelector('.message-content');
            const isLiked = msgContent.classList.contains('liked');

            const toggle = isLiked ? ['empty', unlikeMessage] : ['liked', likeMessage];
            const cache = isLiked ? cacheUnlikedMessage : cacheLikedMessage;

            cache(message.conversation_id, message.id);
            toggle[1](message.id);

            const success = await toggleLike(isLiked, message.id, message.to, message.from);

            if (!success) {
                const revertCache = isLiked ? cacheLikedMessage : cacheUnlikedMessage;
                const revertToggle = isLiked ? likeMessage : unlikeMessage;
                revertCache(message.conversation_id, message.id);
                revertToggle(message.id);
            }
        });
        const replyBtn = messageElement.querySelector('#message-reply-btn');
        if(replyBtn) {
            replyBtn.addEventListener('click', () => {
                showReplyContent();
                setReplyContext(message.id, message.contents, message.conversation_id);
                document.getElementById("message-typed").focus();
            });
        }
        const deleteBtn = messageElement.querySelector('#message-delete-btn');
        if(deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const confirmDelete = window.confirm('Delete "' + message.contents + '" ?');
                if (confirmDelete && setMessageElementToDeleted(message.id, message.to, message.from)) {
                    cacheDeletedMessage(message.conversation_id, message.id);
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

async function setReplyContext(msgId, msgContents, convoId) { 
    document.getElementById('message-typed').dataset.replyTo = msgId;
    document.getElementById('message-typed').dataset.convoId = convoId;

    const preview = document.querySelector('.reply-preview-area');
    preview.classList.add('visible');
    preview.querySelector('.reply-preview-content').innerHTML = msgContents;
    
    setReplyToContextFromCache(msgId);
}
export async function removeReply() {
    document.getElementById('message-typed').dataset.replyTo = "";
    document.getElementById('message-typed').dataset.convoId = "";
    
    const preview = document.querySelector('.reply-preview-area');
    preview.classList.remove('visible');
    preview.querySelector('.reply-preview-content').innerHTML = "";
    
    removeReplyToContextFromCache();
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

export async function setLatestMessage(message, isAllowed = false) {
    const latest = document.querySelector(`[data-chat-id="${message.conversation_id}"]`);
    if((latest && latest.querySelector(`[data-msg-id="${message.id}"]`))
        || (latest && isAllowed === true)) { // if the chat exists, and if the chat's latest is the updated
        if(message.deleted) {
            latest.querySelector('.last-message').innerHTML = '-- message deleted --';
            latest.querySelector('.last-message').dataset.msgId = message.id;
        } else {
            latest.querySelector('.last-message').innerHTML = message.contents;
            latest.querySelector('.last-message').dataset.msgId = message.id;
        }
    }
}


export function likeMessage(msgId) {
    const messageElement = document.querySelector(`.message[data-msg-id="${msgId}"]`);
    if(messageElement) {
        messageElement.querySelector('.message-content').classList.add('liked');
        const likeBtn = messageElement.querySelector(`#message-like-btn`);
        likeBtn.innerHTML = `<i class="fi fi-sr-heart"></i>`;
        likeBtn.style.color = `red`;
    }
}
export function unlikeMessage(msgId) {
    const messageElement = document.querySelector(`.message[data-msg-id="${msgId}"]`);
    if(messageElement) {
        messageElement.querySelector('.message-content').classList.remove('liked');
        const likeBtn = messageElement.querySelector(`#message-like-btn`);
        likeBtn.innerHTML = `<i class="fi fi-br-heart"></i>`;
        likeBtn.style.color = `white`;
    }
}

export async function setMessageElementToDeleted(msgId, receiverId, senderId) {
    const messageElement = document.querySelector(`.message[data-msg-id="${msgId}"]`);
    if(messageElement) {
        messageElement.querySelector('.message-content').classList.add('deleted');

        // set it to deleted in DB, if it's deleted, set all messages to deleted
        const success = await setMessageToDeleted(msgId, receiverId, senderId);
        if(success) {
            const replyTexts = document.querySelectorAll(`.reply-text[data-msg-id="${msgId}"]`);
            if(replyTexts) {
                replyTexts.forEach(replyElement => {
                    replyElement.classList.add('deleted');
                    replyElement.innerHTML = `-- message deleted --`;
                });
            }

            messageElement.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content deleted">-- message deleted --</div>
                    <div class="message-timestamp">
                    </div>
                </div>
            `;

            return true;
        } else {
            messageElement.querySelector('.message-content').classList.remove('deleted');
            return false;
        }
    }
    return false;
}