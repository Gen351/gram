/////////////////////////////////////////////////////////////////////////////

// Under construction ~~~~~~~~~~~~~~~

// Search Conversations /////////////////////////////////////////////////////
import { supabase } from "../supabase/supabaseClient";
import { searchProfiles,
        searchExistingDirectConversation
        } from "../supabase/queryFunctions";


const chatSearch = document.querySelector("#search");
const searchResultsContainer = document.querySelector('.search-results'); // Make sure this div exists in your HTML


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

            const results = await searchProfiles(searchTerm); // Await the async function call

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
                        const existingConversation = await searchExistingDirectConversation(currentSessionUserId, targetUserAuthId);
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
                                    conversation_name: `Chat with ${targetUsername}` // Use the existing targetUsername variable
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

                            // Step 4: Send a Realtime Broadcast to both users
                            const payload = {
                                type: 'new_conversation',
                                conversation_id: conversationIdToLoad,
                                recipient_id: targetUserAuthId,
                                sender_id: currentSessionUserId,
                                conversation_name: conversationNameToLoad // Correctly use the username you already have
                            };

                            // Broadcast to the target user's channel
                            await supabase.channel(`user_notifications_${targetUserAuthId}`)
                                .send({
                                    type: 'broadcast',
                                    event: 'new_conversation_created',
                                    payload: payload
                                });
                                
                            // Broadcast to the current user's channel (so their UI can update)
                            await supabase.channel(`user_notifications_${currentSessionUserId}`)
                                .send({
                                    type: 'broadcast',
                                    event: 'new_conversation_created',
                                    payload: payload
                                });
                            
                            console.log("New direct conversation created and notification sent:", conversationIdToLoad);
                            
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