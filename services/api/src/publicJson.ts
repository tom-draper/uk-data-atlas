/** Published vocabulary differs from the source artifact's code-vintage keys. */
export const publicJson = (value: unknown): string =>
	JSON.stringify(value, (_key, item: unknown) => {
		if (item === null || typeof item !== "object" || Array.isArray(item))
			return item;
		if (!("boundaryYear" in item) && !("boundaryYears" in item))
			return item;
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
	});
