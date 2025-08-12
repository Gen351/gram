document.addEventListener('DOMContentLoaded', () => {
    const openPanelButton = document.getElementById('open-left-panel');
    const closePanelButton = document.getElementById('close-left-panel');
    const leftPanel = document.querySelector('.left-panel');
    if (openPanelButton) {
        openPanelButton.addEventListener('click', () => {
            leftPanel.style.left = `${leftPanel.clientWidth}px`;
            open = true;
            leftPanel.focus();
        });
    }
    if (closePanelButton) {
        closePanelButton.addEventListener('click', () => {
            leftPanel.style.left = '0px';
            open = false;
        });
    }
    document.querySelector('.right-panel').addEventListener('click', (e) => {
        if(open && !openPanelButton.contains(e.target)) {
            leftPanel.style.left = `0px`;
            open = false;
        }
    });

    let touchStartX = 0;
    let isSwiping = false;
    let open = false;
    const panelWidth = leftPanel.clientWidth;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.targetTouches[0].clientX;
        isSwiping = true;
    });

    document.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;

        const dist = e.targetTouches[0].clientX - touchStartX;

        // Prevent dragging too far
        if (open && dist < -panelWidth) return;
        if (!open && dist > panelWidth) return;

        // Calculate target position
        const offset = open ? panelWidth + dist : dist;
        const clampedOffset = Math.max(0, Math.min(panelWidth, offset));
        leftPanel.style.left = `${clampedOffset}px`;
    });

    document.addEventListener('touchend', (e) => {
        const dist = e.changedTouches[0].clientX - touchStartX;
        isSwiping = false;

        if (dist > 100) {
            // Open panel
            open = true;
            leftPanel.style.left = `${panelWidth}px`;
        } else if (dist < -100) {
            // Close panel
            open = false;
            leftPanel.style.left = `0px`;
        } else {
            // Snap back to current state
            leftPanel.style.left = open ? `${panelWidth}px` : `0px`;
        }
    });
});