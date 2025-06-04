// src/login.js

import { supabase } from './supabase/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const authBtn = document.getElementById('authBtn'); // Single auth button
    const authMessage = document.getElementById('auth-message');
    const formSubtitle = document.getElementById('form-subtitle');
    const toggleAuthModeBtn = document.getElementById('toggleAuthModeBtn');
    const togglePrompt = document.getElementById('toggle-prompt');

    // State to track if we are in login mode (true) or signup mode (false)
    let isLoginMode = true; // Default to login mode

    // Function to display messages to the user
    function displayMessage(message, isError = false) {
        authMessage.textContent = message;
        authMessage.style.color = isError ? '#e74c3c' : '#2a9d8f'; // Red for error, green for success
    }

    // Function to update UI based on current mode
    function updateAuthModeUI() {
        if (isLoginMode) {
            formSubtitle.textContent = 'Sign in to your account';
            authBtn.textContent = 'Sign In';
            togglePrompt.textContent = "Don't have an account?";
            toggleAuthModeBtn.textContent = 'Sign Up';
            document.querySelector('#authBtn').style.backgroundColor = '#2a9d8f';
        } else {
            formSubtitle.textContent = 'Create a new account';
            authBtn.textContent = 'Sign Up';
            togglePrompt.textContent = "Already have an account?";
            toggleAuthModeBtn.textContent = 'Sign In';
            document.querySelector('#authBtn').style.backgroundColor = '#e9c46a';
        }
        authMessage.textContent = ''; // Clear previous messages
    }

    // Function to create a profile if it doesn't exist
    async function createProfileIfNotExists(userId, userEmail) {
        try {
            // Check if profile already exists for this auth_id
            const { data: existingProfile, error: fetchError } = await supabase
                .from('profile')
                .select('id')
                .eq('auth_id', userId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found" (expected if profile doesn't exist)
                throw fetchError;
            }

            if (!existingProfile) {
                // Profile does not exist, create it
                const defaultUsername = userEmail.split('@')[0]; // Use part of email as default username
                const { error: insertError } = await supabase
                    .from('profile')
                    .insert({
                        auth_id: userId,
                        username: defaultUsername,
                        bio: 'Hello, I am a new user!' // Default bio
                    });

                if (insertError) {
                    throw insertError;
                }
                console.log('New profile created for user:', userId);
            } else {
                console.log('Profile already exists for user:', userId);
            }
        } catch (error) {
            console.error('Error in createProfileIfNotExists:', error.message);
            displayMessage('Failed to manage user profile. Please contact support.', true);
            // Consider logging out or preventing dashboard access if profile management fails
            // await supabase.auth.signOut();
            // window.location.href = '/index.html';
        }
    }


    // Initial UI setup
    updateAuthModeUI();

    // Redirect to dashboard if already authenticated
    supabase.auth.getSession().then(async ({ data: { session } }) => { // Made async to await profile creation
        if (session) {
            await createProfileIfNotExists(session.user.id, session.user.email); // Check/create profile on session load
            window.location.href = '/dashboard.html';
        }
    }).catch(error => {
        console.error("Error checking session:", error);
    });

    // Handle authentication button click
    authBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent default form submission

        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            displayMessage('Please enter both email and password.', true);
            return;
        }

        if (isLoginMode) {
            displayMessage('Signing in...', false);
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    displayMessage(error.message, true);
                } else if (data.user) {
                    // --- NEW CODE: Check/Create profile on successful LOGIN ---
                    await createProfileIfNotExists(data.user.id, data.user.email);
                    // --- END NEW CODE ---

                    displayMessage('Signed in successfully! Redirecting...', false);
                    window.location.href = '/dashboard.html';
                } else {
                    displayMessage('An unexpected error occurred during sign in.', true);
                }
            } catch (error) {
                console.error('Sign In Error:', error);
                displayMessage('An unexpected error occurred. Please try again.', true);
            }
        } else { // Sign Up mode
            displayMessage('Signing up...', false);
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                });

                if (error) {
                    displayMessage(error.message, true);
                } else if (data.user) {
                    // --- Profile creation on SIGN UP (already existing, but now uses the helper function) ---
                    await createProfileIfNotExists(data.user.id, data.user.email);
                    // --- END Profile creation on SIGN UP ---

                    displayMessage('Signed up successfully! Profile created. Please check your email for confirmation.', false);
                } else {
                    displayMessage('An unexpected error occurred during sign up.', true);
                }
            } catch (error) {
                console.error('Sign Up Error:', error);
                displayMessage('An unexpected error occurred. Please try again.', true);
            }
        }
    });

    // Toggle authentication mode
    toggleAuthModeBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode; // Flip the mode
        updateAuthModeUI(); // Update the UI
        emailInput.value = ''; // Clear inputs on mode switch
        passwordInput.value = '';
    });
});
