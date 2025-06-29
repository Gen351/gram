// src/main.js
import { supabase } from './supabase/supabaseClient.js';
import { setConversationContext } from './utils/send.js';
import { loadMessage, 
        appendLatestMessage,
        scrollAtBottom,
        scrollDown,
        removeReply,
        hideReplyContent,
        setLatestMessage,
        updateMessage
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

import { wallpaperParse,
        drawStaticBackground,
        } from './wallpaperParser.js'; 

import { openChangeThemeDialog } from './utils/bg.js';

import { addMessageToCache, 
        session_conversations 
        } from './utils/cache.js';

import { changeUsernaameDialog } from './utils/profile.js';

import { playNewMessageSound } from './utils/sounds.js';

// FOR THE WALLPAPER ///////////////////////
let canvas;
let wallpaperImage;
let color_scheme;


////////////////////////////////////////////
// Global variables for DOM elements and session data
const profilePicContainer = document.getElementById('profilePicContainer');
const profileInitialSpan = document.getElementById('profile-initial');
const profileDropdown = document.getElementById('profile-dropdown');
const logoutButton = document.getElementById('logout-button');
const changeUsernameButton = document.getElementById('change-username-button');
const convoList = document.querySelector('.chats-list');
const recipientNameElement = document.querySelector('.recipient-name'); // Renamed for clarity
const messageArea = document.querySelector('.message-area');

let currentSessionProfileId = null; // Renamed to avoid confusion and initialized to null
let currentSessionUserId = null;   // Store the auth.users.id
export let currentConvoId = null;
export function getCurrentConversationId() { return currentConvoId; }


// Message Listener /////////////////////////////////////////////////////////////
function initializeUserChannel(userId) {
    const supaChannel = supabase.channel(`user-${userId}`);

    supaChannel
        .on('broadcast', { event: 'new-message' }, ({ payload }) => {
            if (payload.type === 'insert') {
                appendLatestMessage(payload.message, userId, currentConvoId);
                setLatestMessage(payload.message, true);
                addMessageToCache(currentConvoId, payload.message);
                if(payload.message.to == currentSessionUserId) {
                    playNewMessageSound();
                }
            } else if (payload.type === 'update') {
                updateMessage(payload.message);
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
    (async () => {
        canvas = document.getElementById('message-area-bg');
        const parsed = await wallpaperParse('late_night_delight');
        wallpaperImage = parsed.wallpaperImage;
        color_scheme = parsed.colors;
        
        wallpaperImage.onload = async () => {
            await drawStaticBackground(wallpaperImage, color_scheme, canvas);
        };
        wallpaperImage.onerror = () => {
            console.error("Failed to load the wallpaper image.");
        };
        
        // Manually trigger in case the image was cached
        if (wallpaperImage.complete) await drawStaticBackground(wallpaperImage, color_scheme, canvas);;
        
        window.addEventListener('resize', async () => await drawStaticBackground(wallpaperImage, color_scheme, canvas));
    })();
    // SETUP WALLPAPER ///////////////////////////////////////
    //////////////////////////////////////////////////////////


    // RESPONSIVENESS TT~TT /////////////////////////////////////////////////
    if(window.innerWidth < 820) {
        document.querySelector('.recipient-name').innerHTML = `Swipe Left for Conversations`;
    } else {
        document.querySelector('.recipient-name').innerHTML = `Choose a Conversation`;
    }
    document.querySelector('.messenger-container').style.height = `${window.innerHeight}px`;
    console.log("Height set", window.innerHeight);
    
    const openPanelButton = document.getElementById('open-left-panel');
    const leftPanel = document.querySelector('.left-panel');
    if (openPanelButton) {
        openPanelButton.addEventListener('click', () => {
            leftPanel.classList.add('open');
            leftPanel.focus();
        });
    }
    const closePanelButton = document.getElementById('close-left-panel');
    if (closePanelButton) {
        closePanelButton.addEventListener('click', () => {
            leftPanel.classList.remove('open');
        });
    }
    document.querySelector('.right-panel').addEventListener('click', (event) => {
        if(leftPanel.classList.contains('open') && !openPanelButton.contains(event.target)) {
            leftPanel.classList.remove('open');
        }
    });

    let touchStartX = 0;
    let touchEndX = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartX = touchEndX = 0;
        touchStartX = e.changedTouches[0].screenX;
    });
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    });
    function handleSwipeGesture() {
        const swipeDistance = touchStartX - touchEndX;
        if (swipeDistance > 50) { 
            if(leftPanel.classList.contains('open')) leftPanel.classList.remove('open');
        } else if (swipeDistance < -50) {
            if(!leftPanel.classList.contains('open')) leftPanel.classList.add('open');
        }
    }
    /////////////////////////////////////////////////////////////////////////
    // --- Initial UI setup (if elements exist) ---

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
                    // console.log("User's profile ID:", currentSessionProfileId);

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
                return convo;
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


        const conversationRenderData = await Promise.all(conversations.map(async convo => {
            const [displayName, recentMessages] = await Promise.all([
                fetchConversationParticipantUsername(convo.id, userId),
                fetchRecentMessages(convo.id)
            ]);

            return { convo, displayName, recentMessages };
        }));


        for (const { convo, displayName, recentMessages } of conversationRenderData) {
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            chatItem.dataset.chatId = convo.id;

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
                    <div class="last-message ${recentMessages[0]?.deleted ? 'deleted' : ''}" data-msg-id="${recentMessages[0]?.id}">
                        ${recentMessages[0]?.deleted ? '-- message deleted --' : lastMessageText}
                    </div>
                </div>
            `;

            convoList.appendChild(chatItem);

            chatItem.addEventListener('click', async () => {
                if (chatItem.classList.contains('active')) return;

                messageArea.innerHTML = ``;
                removeReply();
                hideReplyContent();

                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                chatItem.classList.add('active');

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

    if(changeUsernameButton) {
        changeUsernameButton.addEventListener('click', () => {
            changeUsernaameDialog();
            document.getElementById('profile-dropdown').classList.remove('active');
        });
    }
    const infoIcon = document.querySelector('#info-icon'); 
    if(infoIcon) {
        infoIcon.addEventListener('click', () => {
            if(currentConvoId !== null)
                openChangeThemeDialog(currentConvoId);
        });
    }



    // --- Example: New chat button ---
    const newChatButton = document.getElementById('new-chat-button');
    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            // console.log('New chat button clicked on dashboard.');
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

    let messages;
    let participants;

    // The core caching logic
    if (!session_conversations[conversationId]) {
        console.log(`Cache miss for ${conversationId}. Fetching from server...`);
        // 1. Fetch data ONCE.
        const [fetchedMessages, fetchedParticipants, convoName, convoType] = await Promise.all([
            fetchMessages(conversationId),
            fetchConversationParticipants(conversationId),
            fetchConversationParticipantUsername(conversationId, currentSessionUserId),
            fetchConversationType(conversationId)
        ]);

        // 2. IMMEDIATELY cache the fetched data.
        if(!session_conversations[conversationId]) {
            session_conversations[conversationId] = {
                convo_name: convoName,
                convo_participants: fetchedParticipants,
                messages: fetchedMessages,
                conversation_type: convoType,
                style: {}
            };
            // console.log("Cached", conversationId, session_conversations[conversationId]);
        }
        
        // 3. Use the data you just fetched for the current view.
        messages = fetchedMessages;
        participants = fetchedParticipants;


    } else {
        console.log(`Cache hit for ${conversationId}. Loading from session.`);
        // Load directly from the cache
        messages = session_conversations[conversationId].messages;
        participants = session_conversations[conversationId].convo_participants;
    }

    // --- The rest of your function remains largely the same ---
    if (participants && participants.length === 2) {
        const otherUserId = participants.find(p => p.participant !== currentSessionUserId).participant;
        setConversationContext(conversationId, currentSessionUserId, otherUserId);
    }
    
    // Get the conversation type from the cache
    const conversation_type = session_conversations[conversationId].conversation_type || 'direct';

    if (!Array.isArray(messages) || messages.length === 0) {
        messageArea.innerHTML = '<p style="text-align: center; color: var(--text-dark);">No messages yet. Start chatting!</p>';
        return;
    }

    // Clear the message area before loading new messages
    messageArea.innerHTML = ''; 

    for (const message of messages) {
        await loadMessage(message, currentSessionUserId, currentConvoId, conversation_type);
    }
    
    const sus = document.querySelectorAll(`.message:not([data-convo-id="${currentConvoId}"])`);
    sus.forEach(msg => msg.remove());

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


// LOADING SHIYS: CACHING  ///////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////