// src/main.js

import { supabase } from './supabase/supabaseClient.js';
import { setConversationContext } from './send.js';

// Global variables for DOM elements and session data
const profilePicContainer = document.getElementById('profilePicContainer');
const profileInitialSpan = document.getElementById('profile-initial');
const profileDropdown = document.getElementById('profile-dropdown');
const logoutButton = document.getElementById('logout-button');
const convoList = document.querySelector('.chats-list');
const recipientNameElement = document.querySelector('.recipient-name'); // Renamed for clarity

let currentSessionProfileId = null; // Renamed to avoid confusion and initialized to null
let currentSessionUserId = null;   // Store the auth.users.id

document.addEventListener('DOMContentLoaded', () => {
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

                // Fetch user profile to display the initial and get profile_id
                const profileData = await fetchUserProfile(currentSessionUserId, session.user.email);

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

    async function fetchUserProfile(userId, userEmail) {
        if (!profilePicContainer || !profileInitialSpan) return null;

        try {
            let { data, error } = await supabase
                .from('profile')
                .select('id, username, bio') // Select 'id' as well!
                .eq('auth_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116: "No rows found"
                throw error;
            }

            if (error && error.code === 'PGRST116') {
                console.log("Profile not found for user, creating a new one.");
                const { data: newProfile, error: insertError } = await supabase
                    .from('profile')
                    .insert([
                        {
                            auth_id: userId,
                            username: userEmail.split('@')[0] || 'New User'
                        }
                    ])
                    .select('id, username, bio') // Select 'id' from the newly inserted profile too
                    .single();

                if (insertError) {
                    console.error("Error creating new profile:", insertError.message);
                    throw insertError;
                }
                data = newProfile;
                console.log("New profile created:", data);
            }

            // Display the initial (first letter of username or email)
            let initial = '?';
            if (data && data.username) {
                initial = data.username.charAt(0).toUpperCase();
            } else if (userEmail) {
                initial = userEmail.charAt(0).toUpperCase();
            }
            profileInitialSpan.textContent = initial;
            profilePicContainer.style.backgroundImage = '';

            return data; // Return the profile data including the ID
        } catch (fetchError) {
            console.error('Error fetching or creating user profile:', fetchError.message);
            const fallbackInitial = userEmail ? userEmail.charAt(0).toUpperCase() : '?';
            profileInitialSpan.textContent = fallbackInitial;
            profilePicContainer.style.backgroundImage = '';
            return null;
        }
    }

    // New function to fetch conversations based on the new schema
    async function fetchConversationsForUser(userId) {
        try {
            // 1) Get all conversation IDs where the user is a participant
            const { data: participations, error: partError } = await supabase
                .from('conversation_participant')
                .select('conversation_id')
                .eq('participant', userId);

            if (partError) throw partError;

            const conversationIds = participations.map(p => p.conversation_id);

            if (conversationIds.length === 0) {
                return []; // User is not part of any conversations
            }

            // 2) Fetch the details of these conversations,
            //    and include participants + group name (if group chat)
            const { data: conversations, error: convoError } = await supabase
                .from('conversation')
                .select(`
                    id,
                    created_at,
                    conversation_name,
                    type,
                    FK_group,
                    group ( group_name ),
                    conversation_participant ( participant )
                `)
                .in('id', conversationIds) // Only conversations the user is part of
                .order('created_at', { ascending: false });

            if (convoError) throw convoError;

            console.log("Fetched conversations:", conversations);

            // 3) Determine a display name for each conversation
            return conversations.map(convo => {
                let displayName = convo.conversation_name;

                if (convo.type === 'group') {
                    // Use group name if available
                    displayName = convo.group?.group_name || `Group Chat ${convo.id}`;
                } else { // type === 'direct'
                    // Find the other participant's username
                    const other = convo.conversation_participant.find(
                        p => p.participant !== userId
                    );
                    displayName = other?.profile?.username || `Chat ${convo.id}`;
                }
                return { ...convo, displayName };
            });
        } catch (fetchError) {
            console.error('Error fetching conversations:', fetchError.message);
            return []; // Return an empty array on error
        }
    }

    async function loadConversations(userId) {
        if (!convoList) return;

        const conversations = await fetchConversationsForUser(userId);
        convoList.innerHTML = ''; // Clear existing list

        if (conversations.length === 0) {
            convoList.innerHTML = '<p style="padding: 15px; color: var(--text-dark);">No conversations yet. Start a new chat!</p>';
            return;
        }

        conversations.forEach(convo => {
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            chatItem.dataset.chatId = convo.id;

            const displayName = convo.displayName;

            chatItem.innerHTML = `
                <div class="chat-avatar"></div>
                <div class="chat-info">
                    <div class="chat-name">${displayName}</div>
                    <div class="last-message">Tap to open chat...</div>
                </div>
            `;
            convoList.appendChild(chatItem);

            chatItem.addEventListener('click', async () => {
                document.querySelectorAll('.chat-item').forEach(item => {
                    item.classList.remove('active');
                });
                chatItem.classList.add('active');

                const chosenConversationId = chatItem.dataset.chatId;
                const chosenConversationName = displayName;
                console.log('Chosen Conversation ID:', chosenConversationId);

                if (recipientNameElement) {
                    recipientNameElement.textContent = chosenConversationName;
                }
                // Call the message loading function for the chosen conversation
                await loadConversationMessages(chosenConversationId);
            });
        });
    }

    // --- Profile Dropdown Toggle Logic ---
    if (profilePicContainer && profileDropdown) {
        profilePicContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

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
 
    console.log('Dashboard main.js loaded.');
}); 
// Dashboard is completely loaded. ////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////
// Choosing a conversation functions /////////////////////////////////////////
const messageArea = document.querySelector('.message-area'); // Assuming you have this element

async function loadConversationMessages(conversationId) {
    if (!messageArea) {
        console.error("Message area not found!");
        return;
    }

    
    try {
        // Fetch messages for the given conversation ID, ordered by creation time
        const { data: messages, error } = await supabase
                .from('message')
                .select(`
                    id,
                    created_at,
                    contents,
                    from,
                    to,
                    from,
                    to
                    `)
                .eq('conversation_id', conversationId) // Updated field name
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error("Error fetching messages:", error.message);
                messageArea.innerHTML = '<p>Error loading messages.</p>';
                return;
            }
            
            // Set the context for sending messages in send.js
            const { data: participants } = await supabase
                    .from('conversation_participant')
                    .select('participant')
                    .eq('conversation_id', conversationId);

            if (participants && participants.length === 2) {
                // 2) Find the “other” user:
                const otherUserId = participants.find(p => p.participant !== currentSessionUserId).participant;

                // 3) Now you know both IDs—call setConversationContext.
                setConversationContext(conversationId, currentSessionUserId, otherUserId);
            }

            // For getting the message type
            let message_type = 'direct'; 
            try {
                const { data: type, error } = await supabase
                        .from('conversation')
                        .select('type')
                        .eq('id', coversationId);
                message_type = type;

                if(error) {
                    console.error("Error fetching messages:", error.message);
                    return;
                }
            } catch(fetchError) {
                // huh unsaon mani?
            }


            messageArea.innerHTML = ''; // Clear previous messages
            
            if (messages.length === 0) {
                messageArea.innerHTML = '<p style="text-align: center; color: var(--text-dark);">No messages yet. Start chatting!</p>';
                return;
            }
            
            messages.forEach(message => {
                const messageElement = document.createElement('div');
                // Determine if the message is from the current user
                const isSentByCurrentUser = message.from === currentSessionUserId;
                
                messageElement.classList.add('message');
                if (isSentByCurrentUser) {
                    messageElement.classList.add('outgoing');
                } else {
                    messageElement.classList.add('incoming');
                }
                
                // Display sender's name (or "You")
                const senderName = (message.profile_from?.username || 'Unknown User');   
                const isSenderNameHidden = (message_type == 'direct') ? 'style="display: none;"' : '';

                messageElement.innerHTML = `
                <div class="message-bubble">
                    <div class="message-sender" ${isSenderNameHidden}>${senderName}</div>
                    <div class="message-content">${message.contents}</div>
                    <div class="message-timestamp">${new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                `;
                messageArea.appendChild(messageElement);
            });
            
            // Scroll to the bottom of the message area
            messageArea.scrollTop = messageArea.scrollHeight;
            
        } catch (fetchError) {
            console.error('Critical error loading messages:', fetchError.message);
            messageArea.innerHTML = '<p>Failed to load messages due to an unexpected error.</p>';
        }
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
        // 1) Find conversation IDs where user1 participates
        const { data: user1Convos, error: err1 } = await supabase
            .from('conversation_participant')
            .select('conversation_id')
            .eq('participant', user1Id);

        if (err1) throw err1;
        const user1Ids = user1Convos.map(r => r.conversation_id);
        if (user1Ids.length === 0) return null;

        // 2) Find conversation IDs where user2 participates AND conversation_id is in user1Ids
        const { data: user2Convos, error: err2 } = await supabase
            .from('conversation_participant')
            .select('conversation_id')
            .eq('participant', user2Id)
            .in('conversation_id', user1Ids);

        if (err2) throw err2;
        const commonIds = user2Convos.map(r => r.conversation_id);
        if (commonIds.length === 0) return null;

        // 3) Fetch the conversation details for those IDs, but only type='direct'
        const { data: convos, error: err3 } = await supabase
            .from('conversation')
            .select('id, type, conversation_name')
            .in('id', commonIds)
            .eq('type', 'direct');

        if (err3) throw err3;

        return convos.length > 0 ? convos[0] : null;
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
                    <div class="chat-avatar"></div>
                    <div class="chat-info">
                        <div class="chat-name">${result.username || 'No Username'}</div>
                    </div>
                `;

                searchResultsContainer.appendChild(resultItem);

                resultItem.addEventListener('click', async () => { // Make click handler async
                    const targetUserAuthId = result.auth_id;
                    const targetUsername = result.username || 'Unknown User';

                    try {
                        // First, try to find an existing direct conversation
                        // between the current user and the target user.
                        const existingConversation = await findExistingDirectConversation(currentSessionUserId, targetUserAuthId);

                        let conversationIdToLoad;
                        let conversationNameToLoad;

                        if (existingConversation) {
                            console.log("Found existing direct conversation:", existingConversation.id);
                            conversationIdToLoad = existingConversation.id;
                            conversationNameToLoad = existingConversation.conversation_name || `Chat with ${targetUsername}`;
                        } else {
                            // No existing direct conversation found, create a new one.
                            console.log("No existing direct conversation found, creating a new one...");

                            // 1) Create the new conversation
                            const { data: newConvo, error: createConvoError } = await supabase
                                .from('conversation')
                                .insert({
                                    type: 'direct',
                                    conversation_name: `Chat with ${targetUsername}`
                                })
                                .select('id, conversation_name')
                                .single();

                            if (createConvoError) {
                                throw createConvoError;
                            }

                            conversationIdToLoad = newConvo.id;
                            conversationNameToLoad = newConvo.conversation_name;
                            console.log("New direct conversation created:", conversationIdToLoad);

                            // 2) Add both users as participants
                            const { error: participantError } = await supabase
                                .from('conversation_participant')
                                .insert([
                                    { participant: currentSessionUserId, conversation_id: conversationIdToLoad },
                                    { participant: targetUserAuthId,  conversation_id: conversationIdToLoad }
                                ]);

                            if (participantError) {
                                throw participantError;
                            }
                        }

                        // After creating/finding, load its messages
                        if (recipientNameElement) {
                            recipientNameElement.textContent = conversationNameToLoad;
                        }
                        await loadConversationMessages(conversationIdToLoad);

                        // Optional: Close search results and refresh conversation list
                        searchResultsContainer.style.display = 'none';
                        chatSearch.value = ''; // Clear search bar
                        await loadConversations(currentSessionUserId); // Refresh the main convo list

                    } catch (error) {
                        console.error("Error creating/opening direct conversation:", error.message);
                        alert("Failed to start direct conversation. Please try again.");
                    }
                });
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
