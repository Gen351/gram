let canvas;
let wallpaperImage;
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('message-area-bg');
    wallpaperImage = new Image();
    wallpaperImage.src = './public/space.svg'; // renamed your PNG file for simplicity

    wallpaperImage.onload = () => {
        drawStaticBackground();
    };
    wallpaperImage.onerror = () => {
        console.error("Failed to load the wallpaper image.");
    };
    window.addEventListener('resize', () => {
        drawStaticBackground();
    });
});
function drawStaticBackground() {
    const ctx = canvas.getContext('2d');
    // Fullscreen canvas

    if(window.innerWidth < 600 ) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = 2140 / 1.75;
        canvas.height = 3840 / 1.75;
    }
    console.log("Bg h: " + canvas.width);
    console.log("Bg w: " + canvas.height);

    // --- 1. Gradient Background ---
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.12, '#222222');
    gradient.addColorStop(0.66, '#999999');
    gradient.addColorStop(0.77, '#AAAAAA');
    gradient.addColorStop(1, '#888888');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // --- 2. Draw smaller, manually repeated SVG ---
    if (wallpaperImage.complete && wallpaperImage.naturalWidth > 0) {
        const patternSize = 400;
        const scale = patternSize / wallpaperImage.naturalWidth;
        const patternHeight = wallpaperImage.naturalHeight * scale;

        ctx.save();
        ctx.globalAlpha = 1;
        for (let y = 0; y < canvas.height; y += patternHeight) {
            for (let x = 0; x < canvas.width; x += patternSize) {
                ctx.drawImage(wallpaperImage, x, y, patternSize, patternHeight);
            }
        }
        ctx.restore();
    }
    // --- 3. Optional overlay for depth ---
    const overlay = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    overlay.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
    overlay.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}