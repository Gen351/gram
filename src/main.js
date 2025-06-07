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
const messageArea = document.querySelector('.message-area');

let currentSessionProfileId = null; // Renamed to avoid confusion and initialized to null
let currentSessionUserId = null;   // Store the auth.users.id
let currentConvoId = null;

// Message Listener /////////////////////////////////////////////////////////////
const supaChannel = supabase.channel('messages-inserts');

supaChannel
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message',
    }, (payload) => {
        appendLatestMessage(payload.new);
    })
    .subscribe();

async function appendLatestMessage(messagePayload) {
    if(messagePayload.conversation_id != currentConvoId) {
        return;
    }
    if(messagePayload.from == currentSessionUserId || messagePayload.to == currentSessionUserId) {
        loadMessage(messagePayload);
        messageArea.scrollTop = messageArea.scrollHeight;
    }
}

/////////////////////////////////////////////////////////////////////////////////





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
    
    async function fetchRecentMessages(conversationID, count = 1) {
        try {
            const { data, error } = await supabase
                .from('message')
                .select('*')
                .eq('conversation_id', conversationID)
                .order('created_at', { ascending: false })
                .limit(count);

            if (error || !data) {
                console.error("Error fetching messages:", error);
                return [];
            }

            return data;

        } catch (fetchError) {
            console.error("Error in fetchRecentMessages:", fetchError.message);
            return [];
        }
    }

    async function fetchConversationParticipantUsername(conversationID, currentUserId) {
        try {
            const { data, error } = await supabase
                .from('conversation_participant')
                .select('participant')
                .eq('conversation_id', conversationID);

            if (error || !data) {
                console.error("Error fetching participants:", error);
                return null;
            }

            // Get the ID of the other participant
            const other = data.find(p => p.participant !== currentUserId);
            const otherParticipantId = other?.participant;

            if (!otherParticipantId) return null;

            const { data: profileData, error: err } = await supabase
                .from('profile')
                .select('username')
                .eq('auth_id', otherParticipantId)
                .single();

            if (err || !profileData) {
                console.error("Error fetching username:", err);
                return null;
            }

            return profileData.username;

        } catch (fetchError) {
            console.error('Error:', fetchError.message);
            return null;
        }
    }

    async function loadConversations(userId) {
        if (!convoList) return;

        const conversations = await fetchConversationsForUser(userId);
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
                    <div class="last-message">${lastMessageText}</div>
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

                await loadConversationMessages(chosenConversationId);
                currentConvoId = chosenConversationId;
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
            
            // Loading the message
            messages.forEach(message => {
                loadMessage(message, message_type);
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

// src/main.js

async function loadMessage(message, message_type = 'direct') {
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
                if (preElement) {
                    preElement.style.display = 'none';
                }
            }
        }
    }
    // --- End: Modify the PREVIOUS message ---

    // Now, create the NEW message. Its timestamp will be visible by default.
    const messageElement = document.createElement('div');
    messageElement.dataset.timestamp = message.created_at; // Crucial for the *next* message

    const isSentByCurrentUser = message.from === currentSessionUserId;
    messageElement.classList.add('message', isSentByCurrentUser ? 'outgoing' : 'incoming');

    const senderName = (message.profile_from?.username || 'Unknown User');
    const isSenderNameHidden = (message_type == 'direct') ? 'style="display: none;"' : '';

    // The new message's timestamp is ALWAYS visible initially.
    // The indent is also always present initially.
    messageElement.innerHTML = `
        <div class="message-bubble">
            <div class="message-sender" ${isSenderNameHidden}>${senderName}</div>
            <div class="message-content">${message.contents}</div>
            <div class="message-timestamp">
                ${new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <pre><br></pre>
            </div>
        </div>
    `;

    messageArea.appendChild(messageElement);
}


////////////////////////////////////////////////////////////////////