/**
 * Converts hex color to RGB object
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 153, g: 153, b: 153 }; // Default gray
}


export const getColorForDensity = (density: number): string => {
    if (density === 0) return '#EEEEEE';

    // Viridis color scale points
    const viridisColors = [
        { threshold: 0, color: [68, 1, 84] },      // #440154 - dark purple
        { threshold: 0.2, color: [59, 82, 139] },  // #3b528b - blue
        { threshold: 0.4, color: [33, 145, 140] }, // #21918c - teal
        { threshold: 0.6, color: [94, 201, 98] },  // #5ec962 - green
        { threshold: 0.8, color: [253, 231, 37] }, // #fde725 - yellow
        { threshold: 1.0, color: [253, 231, 37] }  // #fde725 - yellow (cap)
    ];

    // Normalize density to 0-1 scale (adjust max as needed)
    const maxDensity = 10000;
    const normalizedDensity = Math.min(density / maxDensity, 1);

    // Find the two colors to interpolate between
    let lowerIndex = 0;
    for (let i = 0; i < viridisColors.length - 1; i++) {
        if (normalizedDensity >= viridisColors[i].threshold) {
            lowerIndex = i;
        }
    }

    const upperIndex = Math.min(lowerIndex + 1, viridisColors.length - 1);
    const lower = viridisColors[lowerIndex];
    const upper = viridisColors[upperIndex];

    // Calculate interpolation factor
    const range = upper.threshold - lower.threshold;
    const factor = range === 0 ? 0 : (normalizedDensity - lower.threshold) / range;

    // Interpolate RGB values
    const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * factor);
    const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * factor);
    const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * factor);

    // Convert to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const getColorForAge = (meanAge: number | null): string => {
    if (meanAge === null) return '#EEEEEE';

    const t = Math.max(0, Math.min(1, (meanAge - 25) / 30));
    const colors = [
        { pos: 0.00, color: [68, 1, 84] },
        { pos: 0.25, color: [59, 82, 139] },
        { pos: 0.50, color: [33, 145, 140] },
        { pos: 0.75, color: [94, 201, 98] },
        { pos: 1.00, color: [253, 231, 37] }
    ];

    for (let i = 0; i < colors.length - 1; i++) {
        if (t >= colors[i].pos && t <= colors[i + 1].pos) {
            const localT = (t - colors[i].pos) / (colors[i + 1].pos - colors[i].pos);
            const [r1, g1, b1] = colors[i].color;
            const [r2, g2, b2] = colors[i + 1].color;
            const r = Math.round(r1 + (r2 - r1) * localT);
            const g = Math.round(g1 + (g2 - g1) * localT);
            const b = Math.round(b1 + (b2 - b1) * localT);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    return '#EEEEEE';
}

export const getColorForGenderRatio = (ratio: number | null): string => {
    if (ratio === 0 || ratio === null || isNaN(ratio)) return '#EEEEEE'; // neutral background

    // Clamp ratio extremes to prevent crazy colors
    const clamped = Math.max(0.5, Math.min(2, ratio));

    // Map 0.5 → 0 (pink), 1 → 0.5 (neutral), 2 → 1 (blue)
    const t = (clamped - 0.5) / 1.5;

    // Define the gradient endpoints
    const pink = [255, 105, 180];  // HotPink
    const neutral = [240, 240, 240]; // light gray
    const blue = [70, 130, 180];   // SteelBlue

    let r: number, g: number, b: number;

    if (t < 0.5) {
        // Interpolate from pink → neutral
        const localT = t / 0.5;
        r = Math.round(pink[0] + (neutral[0] - pink[0]) * localT);
        g = Math.round(pink[1] + (neutral[1] - pink[1]) * localT);
        b = Math.round(pink[2] + (neutral[2] - pink[2]) * localT);
    } else {
        // Interpolate from neutral → blue
        const localT = (t - 0.5) / 0.5;
        r = Math.round(neutral[0] + (blue[0] - neutral[0]) * localT);
        g = Math.round(neutral[1] + (blue[1] - neutral[1]) * localT);
        b = Math.round(neutral[2] + (blue[2] - neutral[2]) * localT);
    }

    return `rgb(${r}, ${g}, ${b})`;
}