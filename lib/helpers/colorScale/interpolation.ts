export function normalizeValue(value: number, min: number, max: number) {
	if (max === min) return 0.5;
	return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function hexToRgb(hex: string) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
		: { r: 0, g: 0, b: 0 };
}

export function hexToRgbString(hex: string) {
	const { r, g, b } = hexToRgb(hex);
	return `rgb(${r}, ${g}, ${b})`;
}

export function interpolateColor(color1: string, color2: string, factor: number) {
	const c1 = color1.match(/\d+/g)?.map(Number) || [0, 0, 0];
	const c2 = color2.match(/\d+/g)?.map(Number) || [255, 255, 255];
	const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
	const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
	const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
	return `rgb(${r}, ${g}, ${b})`;
}
