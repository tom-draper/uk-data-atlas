import type { DeclaredHeader, DeclaredPayload } from "./statistics.ts";

/**
 * Parts keyed by the given years, or the calendar years period labels start
 * with, with the standard header fields.
 */
export const yearParts =
	(
		type: string,
		boundaryType: string,
		boundaryYear: number,
		extra: DeclaredHeader = {},
		keys?: string[],
	): DeclaredPayload["parts"] =>
	(labels) =>
		(
			keys ?? [
				...new Set(
					labels
						.filter((label) => /^\d{4}(?!\d)/.test(label))
						.map((label) => label.slice(0, 4)),
				),
			]
		)
			.sort()
			.map((key) => ({
				key,
				header: {
					id: `${type}${key}`,
					type,
					year: Number(key),
					boundaryType,
					boundaryYear,
					...extra,
				},
			}));
