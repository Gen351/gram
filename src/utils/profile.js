import { supabase } from '../supabase/supabaseClient.js';

// --- Elements for the dialog ---
const changeUsernameDialog = document.getElementById('changeUsernameDialog');
const newUsernameInput = document.getElementById('newUsernameInput');
const usernameError = document.getElementById('usernameError');
const cancelUsernameChangeBtn = document.getElementById('cancelUsernameChange');
const saveUsernameChangeBtn = document.getElementById('saveUsernameChange');
const usernameStatusMessage = document.getElementById('usernameStatusMessage');

export async function changeUsername(newUsername) {
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
        // For example: document.getElementById('current-user-name').textContent = updatedData.username;
        setTimeout(() => {
            hideChangeUsernameDialog(); // Hide dialog after a short delay on success
        }, 1000);
    } else {
        // Error message already logged by changeUsername, just display a general one
        usernameStatusMessage.textContent = 'Failed to update username. Please try again.';
        usernameStatusMessage.classList.add('error');
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