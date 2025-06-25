export let session_conversations = {};
export let reply_to = null;
/* FORMAT
    session_conversations[conversationId] = {
        convo_name: convoName,
        convo_participants: fetchedParticipants,
        messages: fetchedMessages,
        conversation_type: convoType,
        style: {}
    };
*/
export function setReplyToContextFromCache(msgId) {reply_to = msgId;}
export function removeReplyToContextFromCache() {reply_to = null;}
export function getReplyContext() { return reply_to;}

export function addMessageToCache(conversation_id, message) {
    if(session_conversations[conversation_id]) {
        session_conversations[conversation_id].messages.push(message);
        console.log("Added to cache:", conversation_id, message);
    }
}

export function cacheDeletedMessage(conversation_id, msgId) {
    if(session_conversations[conversation_id]) {
        const message = session_conversations[conversation_id].messages.find(message => message.id === msgId);
        if(message) {
            message.deleted = true;
            console.log("Cached deleted message");
        }
    }
}
// For when the db returns { false: error } on deletion
export function cacheUndeletedMessage(conversation_id, msgId) {
    if(session_conversations[conversation_id]) {
        const message = session_conversations[conversation_id].messages.find(message => message.id === msgId);
        if(message) {
            message.deleted = false;
            console.log("Cached undeleted message");
        }
    }
}

export function cacheLikedMessage(conversation_id, msgId) {
    if(session_conversations[conversation_id]) {
        const message = session_conversations[conversation_id].messages.find(message => message.id === msgId);
        if(message) {
            message.liked = 'liked';
            console.log("Cached liked message");
        }
    }
}
export function cacheUnlikedMessage(conversation_id, msgId) {
    if(session_conversations[conversation_id]) {
        const message = session_conversations[conversation_id].messages.find(message => message.id === msgId);
        if(message) {
            message.liked = 'empty';
            console.log("Cached unliked message");
        }
    }
}