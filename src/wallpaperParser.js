
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

export async function drawStaticBackground(wallpaperImage = null, color_scheme = null, canvas) {
    if(wallpaperImage === null || color_scheme === null) {
        wallpaperImage = new Image();
        wallpaperImage.src = `/svg/space.svg`;

        const res = await fetch(`/svg/space.json`);
        const data = await res.json();
        if (data?.color_scheme) {
            color_scheme = data.color_scheme;
        }
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- 1. Gradient Background ---
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, color_scheme.a);
    gradient.addColorStop(0.12, color_scheme.b);
    gradient.addColorStop(0.66, color_scheme.c);
    gradient.addColorStop(0.77, color_scheme.d);
    gradient.addColorStop(1, color_scheme.e);
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
