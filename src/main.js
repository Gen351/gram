// src/main.js
import { supabase } from './supabase/supabaseClient.js';
import { setConversationContext } from './send.js';
import { loadMessage, 
        appendLatestMessage,
        updateMessage,
        scrollAtBottom,
        scrollDown,
        removeReply,
        hideReplyContent,
        setLatestMessage
        } from './updateMessage.js';

import { fetchProfile, 
        createProfile, 
        fetchConversationIds, 
        fetchConversationData,
        fetchRecentMessages,
        fetchConversationParticipantUsername,
        fetchConversationType,
        fetchConversationParticipants,
        fetchMessages
        } from './supabase/queryFunctions.js';


// FOR THE WALLPAPER ///////////////////////
let canvas;
let wallpaperImage;
////////////////////////////////////////////


// Global variables for DOM elements and session data
const profilePicContainer = document.getElementById('profilePicContainer');
const profileInitialSpan = document.getElementById('profile-initial');
const profileDropdown = document.getElementById('profile-dropdown');
const logoutButton = document.getElementById('logout-button');
const convoList = document.querySelector('.chats-list');
const recipientNameElement = document.querySelector('.recipient-name'); // Renamed for clarity
const messageArea = document.querySelector('.message-area');

let currentSessionProfileId = null; // Renamed to avoid confusion and initialized to null
let currentSessionUserId = null;   // Store the auth.users.id
let currentConvoId = null;

// Message Listener /////////////////////////////////////////////////////////////
function initializeUserChannel(userId) {
    const supaChannel = supabase.channel(`user-${userId}`);

    supaChannel
        .on('broadcast', { event: 'new-message' }, ({ payload }) => {
            if (payload.type === 'insert') {
                appendLatestMessage(payload.message, userId, currentConvoId);
                setLatestMessage(payload.message, true);
            } else if (payload.type === 'update') {
                // updateMessage(payload.message);
                // setLatestMessage(payload.message);
            } else {
                console.log("Unknown broadcast type");
            }
        })
        .subscribe();
}


// async function addAConvo

/////////////////////////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', () => {
    
    // SETUP WALLPAPER ///////////////////////////////////////
    canvas = document.getElementById('message-area-bg');
    wallpaperImage = new Image();
    wallpaperImage.src = '/space.svg';

    wallpaperImage.onload = () => {
        drawStaticBackground();
    };
    wallpaperImage.onerror = () => {
        console.error("Failed to load the wallpaper image.");
    };
    window.addEventListener('resize', () => {
        drawStaticBackground();
    });
    
    function drawStaticBackground() {
        const ctx = canvas.getContext('2d');
        // Fullscreen canvas

        if(window.innerWidth < 600 ) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        } else {
            canvas.width = 2140 / 1.75;
            canvas.height = 3840 / 1.75;
        }
        console.log("Bg h: " + canvas.width);
        console.log("Bg w: " + canvas.height);

        // --- 1. Gradient Background ---
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.12, '#222222');
        gradient.addColorStop(0.66, '#999999');
        gradient.addColorStop(0.77, '#AAAAAA');
        gradient.addColorStop(1, '#888888');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // --- 2. Draw smaller, manually repeated SVG ---
        if (wallpaperImage.complete && wallpaperImage.naturalWidth > 0) {
            const patternSize = 400;
            const scale = patternSize / wallpaperImage.naturalWidth;
            const patternHeight = wallpaperImage.naturalHeight * scale;

            ctx.save();
            ctx.globalAlpha = 1;
            for (let y = 0; y < canvas.height; y += patternHeight) {
                for (let x = 0; x < canvas.width; x += patternSize) {
                    ctx.drawImage(wallpaperImage, x, y, patternSize, patternHeight);
                }
            }
            ctx.restore();
        }
        // --- 3. Optional overlay for depth ---
        const overlay = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // SETUP WALLPAPER ///////////////////////////////////////
    //////////////////////////////////////////////////////////


    // RESPONSIVENESS TT~TT /////////////////////////////////////////////////
    const openPanelButton = document.getElementById('open-left-panel');
    const leftPanel = document.querySelector('.left-panel');
    if (openPanelButton) {
        openPanelButton.addEventListener('click', () => {
            leftPanel.classList.add('open');
        });
    }
    const closePanelButton = document.getElementById('close-left-panel');
    if (closePanelButton) {
        closePanelButton.addEventListener('click', () => {
            leftPanel.classList.remove('open');
        });
    }

    /////////////////////////////////////////////////////////////////////////








    // --- Initial UI setup (if elements exist) ---
    if (recipientNameElement) {
        recipientNameElement.textContent = 'Choose a conversation...';
    }

    // --- Session Check & User Profile Initialization ---
    supabase.auth.getSession()
        .then(async ({ data: { session }, error: sessionError }) => {
            if (sessionError) {
                console.error("Error getting session:", sessionError.message);
                window.location.href = '/index.html'; // Redirect to login on error
                return;
            }

            if (!session) {
                console.log("No active session, redirecting to login.");
                window.location.href = '/index.html';
            } else {
                console.log("Active session found. User:", session.user.email);
                currentSessionUserId = session.user.id; // Store the auth.users.id
                initializeUserChannel(currentSessionUserId);

                // Fetch user profile to display the initial and get profile_id
                const profileData = await loadUserProfile(currentSessionUserId, session.user.email);

                if (profileData && profileData.id) {
                    currentSessionProfileId = profileData.id; // Assign the profile ID correctly
                    console.log("User's profile ID:", currentSessionProfileId);

                    // Now that we have the user's auth ID, load conversations
                    await loadConversations(currentSessionUserId); // Pass the auth.users.id
                } else {
                    console.error("Could not retrieve profile ID for the session.");
                }
            }
        })
        .catch(criticalError => {
            console.error("Critical error during session check:", criticalError.message);
            window.location.href = '/index.html';
        });

        
    // --- Dashboard loading functions ---
    async function loadUserProfile(userId, userEmail) {
        if (!profilePicContainer || !profileInitialSpan) return null;

        try {
            // Try to fetch existing profile
            const profileData = await fetchProfile(userId);

            let data;
            if (profileData.id) { // Found
                data = profileData;
            } else if (profileData.code === 'PGRST116') {
                // Not found, so create
                console.log("Profile not found for user, creating a new one.");
                data = await createProfile(userId, userEmail);
                console.log("New profile created:", data);
            } else { // Some other error
                throw profileData;
            }

            // Display the initial (first letter of username or email)
            const initial = data.username
                ? data.username.charAt(0).toUpperCase()
                : (userEmail.charAt(0).toUpperCase() || '?');

            profileInitialSpan.textContent = initial;
            profilePicContainer.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${data.username}
                    &size=45
                    &background=${data.username.charCodeAt(0) * 6500}
                    &color=${data.username.charCodeAt(data.username.length - 1) * 900}
                    &length=3
                    &rounded=true
                    &bold=true
                ">
            `;

            return data;
        } catch (err) {
            console.error('Error fetching or creating user profile:', err.message || err);
            // Fallback initial
            const fallback = userEmail ? userEmail.charAt(0).toUpperCase() : '?';
            profileInitialSpan.textContent = fallback;
            profilePicContainer.style.backgroundImage = '';
            return null;
        }
    }

    // New function to fetch conversations based on the new schema
    async function loadConversationsForUser(userId) {
        try {
            // Step 1: fetch all conversation IDs
            const conversationIds = await fetchConversationIds(userId);
            if (conversationIds.length === 0) return [];

            // Step 2: fetch the conversation rows
            const conversations = await fetchConversationData(conversationIds);

            // Step 3: map over them to compute displayName
            return conversations.map(convo => {
            let displayName = convo.conversation_name;

            if (convo.type === 'group') {
                displayName = convo.group?.group_name || `Group Chat ${convo.id}`;
            } else {
                // guard: ensure participants array exists
                const participants = Array.isArray(convo.conversation_participant)
                ? convo.conversation_participant
                : [];

                // find the other user
                const other = participants.find(p => p.participant !== userId);
                displayName = other?.profile?.username || `Chat ${convo.id}`;
            }

            return { ...convo, displayName };
            });
        } catch (err) {
            console.error('Error fetching conversations for user:', err.message || err);
            return [];
        }
    }

    async function loadConversations(userId) {
        if (!convoList) return;

        const conversations = await loadConversationsForUser(userId);
        convoList.innerHTML = '';

        if (conversations.length === 0) {
            convoList.innerHTML = '<p style="padding: 15px; color: var(--text-dark);">No conversations yet. Start a new chat!</p>';
            return;
        }

        for (const convo of conversations) {
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            chatItem.dataset.chatId = convo.id;

            // ✅ Await the username
            const displayName = await fetchConversationParticipantUsername(convo.id, userId);
            const recentMessages = await fetchRecentMessages(convo.id);
            const lastMessageText = recentMessages.length > 0 ? recentMessages[0].contents : 'Tap to open chat...';

            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <div class="char-avatar-wrapper">
                        <img src="https://ui-avatars.com/api/?name=${displayName}
                            &size=50
                            &background=${displayName.charCodeAt(0) * 6500}
                            &color=${displayName.charCodeAt(displayName.length - 1) * 900}
                            &length=3
                            &rounded=true
                            &bold=true
                        ">
                    </div>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${displayName || 'Unknown User'}</div>
                    <div class="last-message ${recentMessages[0].deleted === true ? 'deleted' : ''}" data-msg-id="${recentMessages[0].id}">${recentMessages[0].deleted === true ? '-- message deleted --' : lastMessageText}</div>
                </div>
            `;
            convoList.appendChild(chatItem);

            chatItem.addEventListener('click', async () => {
                if(chatItem.classList.contains('active')) return;
                
                // Clear it first before all....
                messageArea.innerHTML = ``;
                // if currently replying, remove the replying data
                removeReply();
                hideReplyContent();

                document.querySelectorAll('.chat-item').forEach(item => {
                    item.classList.remove('active');
                });
                chatItem.classList.add('active');

                const chosenConversationName = displayName;

                if (recipientNameElement) {
                    recipientNameElement.textContent = chosenConversationName;
                    
                    const recipientAvatar = document.querySelector('.recipient-avatar');
                    recipientAvatar.innerHTML = `
                                                <img src="https://ui-avatars.com/api/?name=${displayName}
                                                    &size=40
                                                    &background=${displayName.charCodeAt(0) * 6500}
                                                    &color=${displayName.charCodeAt(displayName.length - 1) * 900}
                                                    &length=3
                                                    &rounded=true
                                                    &bold=true
                                                ">
                                                `;
                }

                currentConvoId = chatItem.dataset.chatId;
                await loadConversationMessages(currentConvoId);
            });
        }
    }


    // --- Profile Dropdown Toggle Logic ---
    if (profilePicContainer && profileDropdown) {
        profilePicContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }


    // --- Cancel Reply Button ---
    document.getElementById('btn-cancel-reply').addEventListener('click', () => {
        removeReply();
        hideReplyContent();
    });

    // --- Hide Dropdown if Clicked Outside ---
    document.addEventListener('click', (event) => {
        if (profileDropdown && profileDropdown.classList.contains('active')) {
            if (
                !profilePicContainer.contains(event.target) &&
                !profileDropdown.contains(event.target)
            ) {
                profileDropdown.classList.remove('active');
            }
        }
    });

    // --- Logout Button Logic ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (profileDropdown) {
                profileDropdown.classList.remove('active');
            }
            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.error('Error logging out:', error.message);
                    alert('Logout failed: ' + error.message);
                } else {
                    console.log('User logged out successfully.');
                    window.location.href = '/index.html';
                }
            } catch (e) {
                console.error('Exception during logout:', e);
                alert('An unexpected error occurred during logout.');
            }
        });
    }

    // --- Example: New chat button ---
    const newChatButton = document.getElementById('new-chat-button');
    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            console.log('New chat button clicked on dashboard.');
            // Implement new chat UI/logic here, perhaps showing a modal to select users
        });
    }

    // Listen for scroll events
    messageArea.addEventListener("scroll", () => {
        scrollAtBottom();
    });
    // Also observe resize changes in messageArea
    const resizeObserver = new ResizeObserver(() => {
        scrollAtBottom();
    });
    resizeObserver.observe(messageArea);

    // Button click scrolls to bottom
    document.getElementById("scroll-to-bottom-btn").addEventListener("click", () => {
        messageArea.scrollTop = messageArea.scrollHeight;
    });
 
    console.log('Dashboard main.js loaded.');
}); 
// Dashboard is completely loaded. ////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////////////////////////////
// Fetching a message ///////////////////////////////////////////////////////////

// Fetching a message ///////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////
// Choosing a conversation functions /////////////////////////////////////////
async function loadConversationMessages(conversationId) {
    if (!messageArea) { console.error("Message area not found!"); return; }
    
    // Fetch messages for the given conversation ID, ordered by creation time
    const messages = await fetchMessages(conversationId);

    // Set the context for sending messages in send.js
    const participants = await fetchConversationParticipants(conversationId);

    if (participants && participants.length === 2) {
        // 2) Find the “other” user:
        const otherUserId = participants.find(p => p.participant !== currentSessionUserId).participant;

        // 3) Now you know both IDs—call setConversationContext.
        setConversationContext(conversationId, currentSessionUserId, otherUserId);
    }
    // For getting the message type
    let conversation_type = 'direct'; 
    conversation_type = await fetchConversationType(conversationId);

    if (messages.length === 0) {
        messageArea.innerHTML = '<p style="text-align: center; color: var(--text-dark);">No messages yet. Start chatting!</p>';
        return;
    }
    // Loading the message
    for (const message of messages) {
        await loadMessage(message, currentSessionUserId, currentConvoId, conversation_type);
    }
    scrollDown();
}

// Choosing a conversation functions end /////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////
// Search Conversations /////////////////////////////////////////////////////
const chatSearch = document.querySelector("#search");
const searchResultsContainer = document.querySelector('.search-results'); // Make sure this div exists in your HTML

async function getProfiles(searchInput) {
    try {
        // Select relevant fields for search results, excluding the current user's profile
        const { data: profileSearchResults, error } = await supabase
            .from('profile')
            .select('id, username, auth_id')
            .ilike('username', `%${searchInput}%`) // Case-insensitive partial match
            // .neq('auth_id', currentSessionUserId); // DO NOT Exclude the current user

        if (error) {
            console.error("Error fetching profiles:", error.message);
            return [];
        }
        return profileSearchResults;

    } catch (error) {
        console.error("Critical error during profile search:", error.message);
        return [];
    }
}

// Helper function to find an existing direct conversation
// Now based on conversation_participant table
async function findExistingDirectConversation(user1Id, user2Id) {
    try {
        // Step 1: Find conversation IDs where user1 participates
        const { data: user1Convos, error: err1 } = await supabase
            .from('conversation_participant')
            .select('conversation_id')
            .eq('participant', user1Id);

        if (err1 || !user1Convos) throw err1 || new Error("No conversations for user1");

        const user1Ids = user1Convos.map(r => r.conversation_id);
        if (user1Ids.length === 0) return null;

        // Step 2: Filter conversations where user2 also participates
        const { data: user2Convos, error: err2 } = await supabase
            .from('conversation_participant')
            .select('conversation_id')
            .eq('participant', user2Id)
            .in('conversation_id', user1Ids);

        if (err2 || !user2Convos) throw err2 || new Error("No common conversations");

        const commonConversationIds = user2Convos.map(r => r.conversation_id);
        if (commonConversationIds.length === 0) return null;

        // Step 3: Get the conversation where type is 'direct'
        const { data: directConvos, error: err3 } = await supabase
            .from('conversation')
            .select('id, type, conversation_name')
            .in('id', commonConversationIds)
            .eq('type', 'direct');

        if (err3) throw err3;

        // Return the first matched direct conversation (if any)
        return directConvos?.[0] || null;

    } catch (findError) {
        console.error("Error in findExistingDirectConversation:", findError.message);
        return null;
    }
}

chatSearch.addEventListener('keypress', async (event) => { // Mark event listener as async
    if (event.key === 'Enter') {
        const searchTerm = chatSearch.value.trim(); // Trim whitespace
        if (searchTerm !== '') {
            // Clear previous search results
            searchResultsContainer.innerHTML = '';
            // Hide search results if no search is performed or search term is empty
            if (searchTerm === '') {
                searchResultsContainer.style.display = 'none';
                return;
            }

            const results = await getProfiles(searchTerm); // Await the async function call

            if (results.length === 0) {
                searchResultsContainer.style.display = 'block'; // Show container even if empty
                searchResultsContainer.innerHTML = '<p style="padding: 10px; color: var(--text-dark);">No profiles found.</p>';
                return;
            }

            searchResultsContainer.style.display = 'block'; // Show the search results container

            results.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.classList.add('chat-item', 'search-result-item'); // Add a specific class for search results
                resultItem.dataset.profileAuthId = result.auth_id; // Store auth_id of the found profile
                resultItem.dataset.username = result.username;      // Store username for easy access

                resultItem.innerHTML = `
                    <div class="chat-avatar">
                        <img src="https://ui-avatars.com/api/?name=${result.username}
                            &size=50
                            &background=${result.username.charCodeAt(0) * 6500}
                            &color=${result.username.charCodeAt(result.username.length - 1) * 900}
                            &length=3
                            &rounded=true
                            &bold=true
                        ">
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${result.username || 'No Username'}</div>
                    </div>
                `;

                resultItem.addEventListener('click', async () => {
                    const targetUserAuthId = result.auth_id;
                    const targetUsername = result.username || 'Unknown User';

                    try {
                        // Step 1: Check for existing direct conversation
                        const existingConversation = await findExistingDirectConversation(currentSessionUserId, targetUserAuthId);
                        let conversationIdToLoad;

                        if (existingConversation) {
                            console.log("Found existing direct conversation:", existingConversation.id);
                            conversationIdToLoad = existingConversation.id;

                            const chosenConversationId = existingConversation.id;
                            const displayName = result.username;

                            if (recipientNameElement) {
                                recipientNameElement.textContent = displayName;
                                
                                const recipientAvatar = document.querySelector('.recipient-avatar');
                                recipientAvatar.innerHTML = `
                                                            <img src="https://ui-avatars.com/api/?name=${displayName}
                                                                &size=40
                                                                &background=${displayName.charCodeAt(0) * 6500}
                                                                &color=${displayName.charCodeAt(displayName.length - 1) * 900}
                                                                &length=3
                                                                &rounded=true
                                                                &bold=true
                                                            ">
                                                            `;
                            }
                            await loadConversationMessages(chosenConversationId);

                        } else {
                            // Step 2: Create new direct conversation
                            console.log("No existing conversation. Creating a new one...");

                            const { data: newConvo, error: createConvoError } = await supabase
                                .from('conversation')
                                .insert({
                                    type: 'direct',
                                    conversation_name: `Chat with ${targetUsername}`
                                })
                                .select('id, conversation_name')
                                .single();

                            if (createConvoError) throw createConvoError;

                            conversationIdToLoad = newConvo.id;
                            const conversationNameToLoad = newConvo.conversation_name;

                            // Step 3: Add both participants
                            const { error: participantError } = await supabase
                                .from('conversation_participant')
                                .insert([
                                    { participant: currentSessionUserId, conversation_id: conversationIdToLoad },
                                    { participant: targetUserAuthId, conversation_id: conversationIdToLoad }
                                ]);

                            if (participantError) throw participantError;

                            console.log("New direct conversation created:", conversationIdToLoad);
                            
                            // Load messages from this conversation
                            await loadConversationMessages(conversationIdToLoad);
                        }


                        // Step 5: Close search and refresh convo list
                        searchResultsContainer.style.display = 'none';
                        chatSearch.value = '';

                    } catch (error) {
                        console.error("Error creating/opening direct conversation:", error.message);
                        alert("Failed to start direct conversation. Please try again.");
                    }
                });


                searchResultsContainer.appendChild(resultItem);
            });
        } else {
            searchResultsContainer.innerHTML = ''; // Clear results if search input is empty
            searchResultsContainer.style.display = 'none'; // Hide results
        }
    }
});

// Add a way to hide search results when clicking outside
document.addEventListener('click', (event) => {
    if (searchResultsContainer && searchResultsContainer.classList.contains('search-results')) {
        if (!chatSearch.contains(event.target) && !searchResultsContainer.contains(event.target)) {
            searchResultsContainer.style.display = 'none';
        }
    }
});

// Search Conversations End /////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////


// LOADING SHIYS ///////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////