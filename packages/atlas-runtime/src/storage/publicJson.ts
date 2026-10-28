const renamed = (_key: string, item: unknown) => {
	if (item === null || typeof item !== "object" || Array.isArray(item))
		return item;
	if (!("boundaryYear" in item) && !("boundaryYears" in item)) return item;
	return Object.fromEntries(
		Object.entries(item).map(([key, entry]) => [
			key === "boundaryYear"
				? "codeYear"
				: key === "boundaryYears"
					? "codeYears"
					: key,
			entry,
		]),
	);
};

/**
 * Published vocabulary differs from the source artifact's code-vintage keys.
 * Most bodies hold neither key, and a replacer slows every value it visits,
 * so the body is serialised plainly first. If no key began with
 * "boundaryYear the plain form is already the published one.
 */
export const publicJson = (value: unknown): string => {
	const plain = JSON.stringify(value);
	return plain === undefined || !plain.includes('"boundaryYear')
		? plain
		: JSON.stringify(value, renamed);
};
