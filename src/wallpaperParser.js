import { supabase } from './supabase/supabaseClient.js'; // Adjust path as per your project

// --- Elements for the Theme Dialog ---
const changeThemeDialog = document.getElementById('changeTheme');
const themesContainer = document.querySelector('.theme-dialog .themes'); // Target the container for theme cards
const saveThemeChangeBtn = document.getElementById('saveThemeChange');
const cancelThemeChangeBtn = document.getElementById('cancelThemeChange');
const changeThemeStatusMessage = document.getElementById('changeThemeStatusMessage');
// ALL the svg(s) are from:
// https://github.com/crashmax-dev/twallpaper/tree/master/website/public/patterns


export async function wallpaperParse(bgStyle) {
    let color_scheme = {
        a: "#777777",
        b: "#777777",
        c: "#777777",
        d: "#777777",
        e: "#777777"
    };
    
    try {
        const res = await fetch(`/svg/${bgStyle}.json`);
        const data = await res.json();
        if (data?.color_scheme) {
            color_scheme = data.color_scheme;
        }
    } catch (err) {
        console.warn("Could not load color scheme:", err);
    }
    
    const wallpaperImage = new Image();
    wallpaperImage.src = `/svg/${bgStyle}.svg`;
    
    return { wallpaperImage, colors: color_scheme };
}


// --- Globals for theme management ---
const ALL_THEME_IDS = [
    "space", "underwater_world", "star_wars", "math", "late_night_delight",
    "games", "fantasy", "beach", "astronaut_cats"
];
let selectedThemeId = null; // To keep track of the currently selected theme
let currentConvoId = null;

// --- Helper functions for dialog visibility ---
function showChangeThemeDialog(conversation_id) {
    currentConvoId = conversation_id;
    changeThemeDialog.classList.add('active');
    changeThemeStatusMessage.textContent = ''; // Clear status message
    renderThemeCards(); // Render/re-render theme cards when dialog opens
    // Highlight the currently active theme (if user has one saved)
    highlightCurrentTheme(currentConvoId);
}

function hideChangeThemeDialog() {
    changeThemeDialog.classList.remove('active');
}

// --- Function to apply theme colors to the document root ---
async function applyThemeColors(themeId) {
    const { colors } = await wallpaperParse(themeId); // Use your existing parser

    if (colors) {
        const root = document.documentElement; // The <html> element
        root.style.setProperty('--bg-primary', colors.a);
        root.style.setProperty('--bg-secondary', colors.b);
        root.style.setProperty('--bg-tertiary', colors.c);
        // Map other color_scheme properties to your CSS variables as needed
        // For example:
        // root.style.setProperty('--text-light', colors.d);
        // root.style.setProperty('--text-dark', colors.e);
        // You'll need to define what each color (a,b,c,d,e) from your JSON means in your theme CSS variables
    }
}

// --- Function to render theme cards dynamically ---
function renderThemeCards() {
    themesContainer.innerHTML = ''; // Clear previous cards
    ALL_THEME_IDS.forEach(themeId => {
        const themeCard = document.createElement('div');
        themeCard.id = themeId; // Set ID for background image CSS
        themeCard.classList.add('theme-card');
        themeCard.innerHTML = `<span>${themeId.replace(/-/g, ' ')}</span>`; // Display name, e.g., "Underwater World"
        
        themeCard.addEventListener('click', () => {
            // Remove 'selected' from all cards
            themesContainer.querySelectorAll('.theme-card').forEach(card => {
                card.classList.remove('selected');
            });
            // Add 'selected' to the clicked card
            themeCard.classList.add('selected');
            selectedThemeId = themeId; // Store the selected theme
        });
        themesContainer.appendChild(themeCard);
    });
}

// --- Function to highlight the currently saved theme ---
async function highlightCurrentTheme(conversation_id) {
    if(!conversation_id) {
        return;
    }
    const activeChat = document.querySelector('.chat-item.active');
    if(!activeChat) {
        return;
    }
    const { data, error } = await supabase
        .from('conversation')
        .select('bg_style') // Assuming 'theme' is a column in your 'profile' table
        .eq('id', conversation_id)
        .single();
    if (error) {
        console.error('Error fetching user theme:', error.message);
        return;
    }
    if (data?.theme) {
        selectedThemeId = data.theme; // Set global selectedThemeId to user's saved theme
        const currentThemeCard = document.getElementById(selectedThemeId);
        if (currentThemeCard) {
            themesContainer.querySelectorAll('.theme-card').forEach(card => {
                card.classList.remove('selected');
            });
            currentThemeCard.classList.add('selected');
        } else {
             console.warn(`Saved theme ID '${selectedThemeId}' not found among available themes.`);
        }
        applyThemeColors(selectedThemeId); // Also apply the saved theme colors on load
    } else {
        // No theme saved or default theme
        // Optionally, apply a default theme here if none is saved
        // applyThemeColors(ALL_THEME_IDS[0]); // Apply the first theme as default
        // themesContainer.querySelector(`#${ALL_THEME_IDS[0]}`)?.classList.add('selected');
    }
}
// --- Event Listeners for dialog buttons ---
cancelThemeChangeBtn.addEventListener('click', () => {
    hideChangeThemeDialog();
    // Optional: Revert to previously saved theme if user cancels
    highlightCurrentTheme();
});
saveThemeChangeBtn.addEventListener('click', async () => {
    if (!selectedThemeId) {
        changeThemeStatusMessage.textContent = 'Please select a theme first.';
        changeThemeStatusMessage.classList.remove('success');
        changeThemeStatusMessage.classList.add('error');
        return;
    }
    changeThemeStatusMessage.textContent = 'Saving theme...';
    changeThemeStatusMessage.className = 'status-message'; // Reset class

    if (!currentConvoId) {
        return;
    }
    // Save selectedThemeId to Supabase profile table
    const { error } = await supabase
        .from('conversation')
        .update({ bg_style: selectedThemeId })
        .eq('id', currentConvoId);

    if (error) {
        console.error('Failed to update theme:', error.message);
        changeThemeStatusMessage.textContent = 'Failed to save theme. Please try again.';
        changeThemeStatusMessage.classList.add('error');
    } else {
        changeThemeStatusMessage.textContent = 'Theme saved successfully!';
        changeThemeStatusMessage.classList.add('success');
        applyThemeColors(selectedThemeId); // Apply the theme colors immediately
        setTimeout(() => {
            hideChangeThemeDialog(); // Hide dialog after a short delay on success
        }, 1000);
    }
});
// --- Initial Setup on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    highlightCurrentTheme();
});
// --- Export for external access if needed (e.g., from a dropdown button) ---
export function openChangeThemeDialog(conversation_id) {
    showChangeThemeDialog(conversation_id);
}
