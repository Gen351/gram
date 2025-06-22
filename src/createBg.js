let canvas;
let svgImage;

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('message-area-bg');
    svgImage = new Image();
    svgImage.src = '/space.svg'; // assuming it's in the public folder

    // Handle SVG image loading
    svgImage.onload = () => {
        drawStaticBackground();
    };

    svgImage.onerror = () => {
        console.error("Failed to load SVG image. Please ensure '/space.svg' path is correct.");
        drawStaticBackground(); // fallback
    };

    // Set canvas size on load
    window.onload = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawStaticBackground();
    };

    // Redraw on resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            drawStaticBackground();
        }, 100);
    });
});

// Function to draw the static background
export function drawStaticBackground() {
    if (!canvas || !svgImage) return;

    const ctx = canvas.getContext('2d');

    // Resize canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#ff9966');
    gradient.addColorStop(0.25, '#ffcc00');
    gradient.addColorStop(0.5, '#66cc99');
    gradient.addColorStop(0.75, '#3366cc');
    gradient.addColorStop(1, '#663399');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pattern overlay
    if (svgImage.complete && svgImage.naturalWidth > 0) {
        const pattern = ctx.createPattern(svgImage, 'repeat');
        if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else {
        console.warn("SVG image not ready. Skipping pattern.");
    }

    // Dark overlay
    const overlay = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    overlay.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
    overlay.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
