export const lazyValue = <T>(read: () => T): (() => T) => {
	let cached: { value: T } | undefined;
	return () => (cached ??= { value: read() }).value;
};
