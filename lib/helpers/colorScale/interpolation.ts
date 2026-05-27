export function normalizeValue(value: number, min: number, max: number) {
	if (max === min) return 0.5;
	return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function hexToRgb(hex: string) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
			}
		: { r: 0, g: 0, b: 0 };
}

export function rgbToHex(r: number, g: number, b: number): string {
	return (
		"#" +
		[r, g, b]
			.map((v) => Math.round(v).toString(16).padStart(2, "0"))
			.join("")
	);
}

// Mixes a hex color toward white. factor=0 returns original, factor=1 returns white.
export function lightenHex(hex: string, factor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
}
