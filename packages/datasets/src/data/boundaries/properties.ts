/** Returns the first populated value among a boundary feature's known keys. */
export const getProp = (
	props: object,
	keys: readonly string[],
): string | undefined => {
	for (const key of keys) {
		const value = Reflect.get(props, key);
		if (typeof value === "string" && value) return value;
	}
	return undefined;
};
