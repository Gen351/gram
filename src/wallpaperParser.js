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
        const res = await fetch(`/${bgStyle}.json`);
        const data = await res.json();
        if (data?.color_scheme) {
            color_scheme = data.color_scheme;
        }
    } catch (err) {
        console.warn("Could not load color scheme:", err);
    }

    const wallpaperImage = new Image();
    wallpaperImage.src = `/${bgStyle}.svg`;

    return { wallpaperImage, colors: color_scheme };
}
