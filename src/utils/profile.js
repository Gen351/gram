import { supabase } from '../supabase/supabaseClient.js';

import { createProfile,
        fetchProfile
        } from '../supabase/queryFunctions.js';

// --- Elements for the dialog ---
const changeUsernameDialog = document.getElementById('changeUsernameDialog');
const newUsernameInput = document.getElementById('newUsernameInput');
const usernameError = document.getElementById('usernameError');
const cancelUsernameChangeBtn = document.getElementById('cancelUsernameChange');
const saveUsernameChangeBtn = document.getElementById('saveUsernameChange');
const usernameStatusMessage = document.getElementById('usernameStatusMessage');

export async function changeUsername(newUsername) {
    // Read all usernames to check if that username exists
    const { data: profiles, error: fetchError } = await supabase
        .from('profile')
        .select('username');
    if(fetchError) {
        console.error("Failed to fetch usernames:", fetchError.message)
        return null;
    }
    if(profiles) {
        for(const profile of profiles) {
            if(profile.username === newUsername) {
                alert("Username Already Exists!");
                return null;
            }
        }
    }

    const { data, error } = await supabase
        .from('profile')
        .update({ username: newUsername })
        .eq('auth_id', (await supabase.auth.getUser()).data.user.id)
        .select()
        .single();
        
    if(error) {
        console.error('Failed to update username:', error.message);
        return null;
    }
    
    return data;
}



// --- Helper functions for dialog visibility ---
function showChangeUsernameDialog() {
    changeUsernameDialog.classList.add('active');
    newUsernameInput.value = ''; // Clear input on show
    usernameError.style.display = 'none'; // Hide any previous error
    usernameStatusMessage.textContent = ''; // Clear status message
    newUsernameInput.focus(); // Focus the input field
}

function hideChangeUsernameDialog() {
    changeUsernameDialog.classList.remove('active');
}

// --- Event Listeners for dialog buttons ---
cancelUsernameChangeBtn.addEventListener('click', () => {
    hideChangeUsernameDialog();
});

saveUsernameChangeBtn.addEventListener('click', async () => {
    const newUsername = newUsernameInput.value.trim();

    // Basic validation
    if (newUsername.length < 3 || newUsername.length > 20) {
        usernameError.textContent = 'Username must be between 3 and 20 characters.';
        usernameError.style.display = 'block';
        return;
    }

    // You might add more validation here (e.g., allowed characters)

    usernameError.style.display = 'none'; // Hide error if validation passes
    usernameStatusMessage.textContent = 'Saving username...';
    usernameStatusMessage.className = 'status-message'; // Reset class

    // Call your backend function
    const updatedData = await changeUsername(newUsername); // Call your existing function

    if (updatedData) {
        usernameStatusMessage.textContent = 'Username updated successfully!';
        usernameStatusMessage.classList.add('success');
        // Optional: Update displayed username in your main UI here
        const user_id = (await supabase.auth.getUser()).data.user.id;
        loadUserProfile(user_id, newUsername);
        setTimeout(() => {
            hideChangeUsernameDialog();
        }, 1000);

    } else {
        usernameStatusMessage.textContent = 'Failed to update username';
        usernameStatusMessage.classList.add('error');
        setTimeout(() => {
            hideChangeUsernameDialog();
        }, 500);
    }
});

// --- Export or integrate this function wherever you need to open the dialog ---
// For example, if you have a "Settings" button or a profile picture click:
export function changeUsernaameDialog() { // This is the function you asked for
    showChangeUsernameDialog();
}

// Example of how you might trigger it (e.g., a button in your main HTML):
// document.getElementById('openChangeUsernameBtn').addEventListener('click', changeUsernaameDialog);
// Or from your profile dropdown if you have one.
export async function loadUserProfile(userId, username = null) {
    const profileInitialSpan = document.getElementById('profile-initial');
    const profilePicContainer = document.getElementById('profilePicContainer');

    if (!profilePicContainer || !profileInitialSpan) return null;

    if(username === null) {
        username = 'RANDOM';
    }

    try {
        // Try to fetch existing profile
        const profileData = await fetchProfile(userId);

        let data;
        if (profileData.id) { // Found
            data = profileData;
            console.log("Changed to: ", data.username);
        } else if (profileData.code === 'PGRST116') {
            // Not found, so create
            console.log("Profile not found for user, creating a new one.");
            data = await createProfile(userId, username);
            console.log("New profile created:", data);
        } else { // Some other error
            console.log("??");
            throw profileData;
        }

        // Display the initial (first letter of username or email)
        const initial = data.username
            ? data.username.charAt(0).toUpperCase()
            : (username.charAt(0).toUpperCase() || '?');

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
        const fallback = username ? username.charAt(0).toUpperCase() : '?';
        profileInitialSpan.textContent = fallback;
        profilePicContainer.style.backgroundImage = '';
        return null;
    }
}