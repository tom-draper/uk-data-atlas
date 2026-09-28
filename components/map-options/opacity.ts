export const opacityFromInput = (input: string): number | null => {
	const parsed = Number.parseInt(input, 10);
	if (Number.isNaN(parsed)) return null;
	return Math.min(100, Math.max(0, parsed)) / 100;
};

export const normalizedOpacityInput = (input: string): string => {
	const parsed = Number.parseInt(input, 10) || 60;
	return String(Math.min(100, Math.max(0, parsed)));
};
