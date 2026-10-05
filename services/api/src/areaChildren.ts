import type { AreaRelationship } from "./areaRelationships";
import type { RouteContext } from "./routing";
import { releaseMonth } from "./releaseForDate";

type ChildSelection =
	| { kind: "contemporary"; geography?: string }
	| { kind: "release"; geography: string; release: string };

const parseSelection = (value: string | null): ChildSelection | undefined => {
	if (value === null || value.trim() === "") return { kind: "contemporary" };
	const [geography, release, ...rest] = value.split("/");
	if (!geography || rest.length > 0) return undefined;
	return release
		? { kind: "release", geography, release }
		: { kind: "contemporary", geography };
};

/**
 * The children useful beside one parent release. Relationships retain every
 * published vintage, but a browse request should not mix a current parent
 * with a decade of superseded children. A named child release remains exact.
 */
export const selectAreaChildren = (
	context: RouteContext,
	parentRelease: string,
	contained: AreaRelationship[],
	value: string | null,
):
	| { children: AreaRelationship[]; selection: ChildSelection }
	| { error: "invalid" | "none"; choices: string[] } => {
	const selection = parseSelection(value);
	const layers = [
		...new Set(
			contained.map(
				({ counterpart }) =>
					`${counterpart.geography}/${counterpart.boundaryRelease}`,
			),
		),
	].sort();
	if (!selection) return { error: "invalid", choices: layers };
	if (selection.kind === "release") {
		const children = contained.filter(
			({ counterpart }) =>
				counterpart.geography === selection.geography &&
				counterpart.boundaryRelease === selection.release,
		);
		return children.length > 0
			? { children, selection }
			: { error: "none", choices: layers };
	}
	const month = releaseMonth(parentRelease) ?? "9999-12";
	const geographies = [
		...new Set(
			contained
				.map(({ counterpart }) => counterpart.geography)
				.filter(
					(geography) =>
						selection.geography === undefined ||
						geography === selection.geography,
				),
		),
	];
	const children = geographies.flatMap((geography) => {
		const current = context.geographyResolver.selectReleaseForDate(
			geography,
			month,
		);
		if (current?.status !== "selected") return [];
		return contained.filter(
			({ counterpart }) =>
				counterpart.geography === geography &&
				counterpart.boundaryRelease === current.selected.id,
		);
	});
	return children.length > 0
		? { children, selection }
		: { error: "none", choices: layers };
};
