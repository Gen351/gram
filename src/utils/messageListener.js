// const messageArea = document.querySelector('.message-area');

// let pressTimer;
// const LONG_PRESS_DURATION = 500; // 500 milliseconds

// const handleLongPress = (targetElement) => {
//     const clickedMessage = targetElement.closest('.message-bubble');
//     if (clickedMessage) {
//         console.log('A long-press occurred on a message!', clickedMessage);

//         const messageId = clickedMessage.parentElement.dataset.messageId; 
//         console.log(messageId);
        
//         // Add your long-press logic here, e.g., show a context menu
//         clickedMessage.classList.add('highlight-longpress');
//     }
// };

// messageArea.addEventListener('mousedown', (event) => {
//     // Only start timer for left-clicks (button 0)
//     if (event.button === 0) {
//         pressTimer = setTimeout(() => {
//             handleLongPress(event.target);
//         }, LONG_PRESS_DURATION);
//     }
// });

// messageArea.addEventListener('touchstart', (event) => {
//     // Prevent the default touch action to avoid things like scrolling or context menus
//     event.preventDefault(); 
//     pressTimer = setTimeout(() => {
//         handleLongPress(event.target);
//     }, LONG_PRESS_DURATION);
// });

// messageArea.addEventListener('mouseup', () => {
//     clearTimeout(pressTimer);
// });

// messageArea.addEventListener('touchend', () => {
//     clearTimeout(pressTimer);
// });

// messageArea.addEventListener('contextmenu', (event) => {
//     // Prevent the browser's default context menu on right-click
//     event.preventDefault();
// });