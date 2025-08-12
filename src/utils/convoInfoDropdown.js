import {DELETE_conversation} from '../supabase/queryFunctions.js';

const chatInfoDropdown = document.getElementById('chat-info-dropdown');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const changeChatNameBtn = document.getElementById('change-chat-name-btn');

if(chatInfoDropdown) {
    chatInfoDropdown.addEventListener('blur', () => {
        if(chatInfoDropdown.classList.contains('active')) {
            chatInfoDropdown.classList.remove('active');
        }
    });

    if(deleteChatBtn) {
        deleteChatBtn.addEventListener('click', () => {
            const confirmDelete = window.confirm('Delete conversation?');
            if(confirmDelete) {
                const convoId = document.getElementById('info-icon').dataset.convoId;
                if(convoId) {
                    console.log('Deleted...(Still not because I said so...(NOT DONE BUILDING))')
                    // DELETE_conversation(convoId);
                }
            }
        });
    }

    if(changeChatNameBtn) {

    }
}

