import {
	releaseYear,
	type AreaRef,
} from "@uk-data-atlas/catalogue/place-profile";

export type Relationship = {
	relation: string;
	counterpart: {
		geography: string;
		boundaryRelease: string;
		code: string;
		labels?: string[];
	};
};

export const ref = ({ counterpart }: Relationship): AreaRef => ({
	geography: counterpart.geography,
	release: counterpart.boundaryRelease,
	code: counterpart.code,
	name: counterpart.labels?.[0] ?? counterpart.code,
});

export const namedRef = (location: {
	id: string;
	label: string;
	kind: string;
}) => ({
	id: location.id,
	label: location.label,
	kind: location.kind,
});

/**
 * The counterpart from a release of about the same time as `release`: the
 * newest at or before it, within a year, or failing that the oldest after it
 * within a year.
 */
export function contemporary(
	relationships: Relationship[],
	release: string,
): AreaRef | undefined {
	const year = releaseYear(release);
	const near = relationships
		.map(ref)
		.filter((area) => Math.abs(releaseYear(area.release) - year) <= 1)
		.sort((a, b) => a.release.localeCompare(b.release));
	return (
		near.filter((area) => area.release <= release).at(-1) ??
		near.find((area) => area.release > release)
	);
}

export const uniqueRefs = (refs: AreaRef[]) => [
	...new Map(
		refs.map((area) => [`${area.release}/${area.code}`, area]),
	).values(),
];
