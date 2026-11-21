/**
 * What happened to the areas of one geography between two releases, read off
 * the links between them. Pure: `areaChangeEvents.ts` feeds it rows from the
 * crosswalk tables.
 *
 * Areas joined by links form a component, and the component's shape names the
 * change: one area to one area is unchanged, renamed or recoded, one to many is
 * a split, many to one is a merge and many to many is a redistribution. An
 * earlier area with no link ended, a later area with no link was created.
 *
 * A link can say how it was found. A `redrawn` link joins an area to the area
 * of its own code whose extent moved; alone in its component it makes a
 * `redrawn` change, where an area with no such flag would be unchanged. A
 * `realigned` link joins an area to the successor an extent-continuity
 * crosswalk lists, its extent moved by a street but each keeping nearly all of
 * the other, and marks its change `realigned`.
 */
export const CHANGE_KINDS = [
	"unchanged",
	"renamed",
	"recoded",
	"redrawn",
	"split",
	"merged",
	"redistributed",
	"ended",
	"created",
] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

export type ChangeArea = {
	versionId: number;
	areaId: number;
	code: string;
	name: string;
};

export type ChangeLink = {
	fromVersionId: number;
	toVersionId: number;
	/** The population weight of the link, when one is held. */
	weight: number | null;
	/** The area kept its code but its extent moved, and no successor is claimed. */
	redrawn?: boolean;
	/** The successor is one an extent-continuity crosswalk lists as realigned. */
	realigned?: boolean;
};

export type AreaChange = {
	kind: ChangeKind;
	/** Whether any link of the change is realigned rather than a same-area match. */
	realigned: boolean;
	/** Sorted by code. Empty for a created area. */
	from: ChangeArea[];
	/** Sorted by code. Empty for an ended area. */
	to: ChangeArea[];
	links: ChangeLink[];
};

/** Code order, not locale order, so ids do not depend on the machine. */
export const compareText = (a: string, b: string) =>
	a < b ? -1 : a > b ? 1 : 0;

const byCode = (a: ChangeArea, b: ChangeArea) =>
	compareText(a.code, b.code) || a.versionId - b.versionId;

/** The kind of a component that has areas on both sides. */
export function classifyComponent(
	from: readonly ChangeArea[],
	to: readonly ChangeArea[],
	redrawn = false,
): ChangeKind {
	if (from.length === 1 && to.length === 1) {
		if (from[0]!.code !== to[0]!.code) return "recoded";
		if (redrawn) return "redrawn";
		return from[0]!.name === to[0]!.name ? "unchanged" : "renamed";
	}
	if (from.length === 1) return "split";
	if (to.length === 1) return "merged";
	return "redistributed";
}

/**
 * Groups the links of two releases into changes, unchanged ones included.
 * `from` and `to` are every area of each release. A link naming an area outside
 * them is a caller error.
 *
 * `ended` and `created` name areas that have no link. A caller that knows an
 * area only fell outside a release's coverage leaves it out of `from` or `to`.
 * Ordered by the smallest code on the from side, then the to side.
 */
export function classifyChanges(
	from: readonly ChangeArea[],
	to: readonly ChangeArea[],
	links: readonly ChangeLink[],
): AreaChange[] {
	const fromById = new Map(from.map((area) => [area.versionId, area]));
	const toById = new Map(to.map((area) => [area.versionId, area]));
	// Union-find over "f<id>" and "t<id>", so the two sides never collide.
	const parent = new Map<string, string>();
	const find = (key: string): string => {
		let root = key;
		while (parent.get(root) !== root) root = parent.get(root)!;
		for (let next = key; next !== root;) {
			const up = parent.get(next)!;
			parent.set(next, root);
			next = up;
		}
		return root;
	};
	for (const area of from)
		parent.set(`f${area.versionId}`, `f${area.versionId}`);
	for (const area of to)
		parent.set(`t${area.versionId}`, `t${area.versionId}`);
	for (const link of links) {
		if (!fromById.has(link.fromVersionId) || !toById.has(link.toVersionId))
			throw new Error(
				`A link joins area versions ${link.fromVersionId} and ${link.toVersionId}, which are not in the two releases`,
			);
		parent.set(
			find(`f${link.fromVersionId}`),
			find(`t${link.toVersionId}`),
		);
	}
	const components = new Map<
		string,
		{ from: ChangeArea[]; to: ChangeArea[]; links: ChangeLink[] }
	>();
	const component = (key: string) => {
		const root = find(key);
		let found = components.get(root);
		if (!found)
			components.set(root, (found = { from: [], to: [], links: [] }));
		return found;
	};
	for (const area of from) component(`f${area.versionId}`).from.push(area);
	for (const area of to) component(`t${area.versionId}`).to.push(area);
	for (const link of links)
		component(`f${link.fromVersionId}`).links.push(link);
	const changes: AreaChange[] = [];
	for (const found of components.values()) {
		found.from.sort(byCode);
		found.to.sort(byCode);
		const kind: ChangeKind =
			found.to.length === 0
				? "ended"
				: found.from.length === 0
					? "created"
					: classifyComponent(
							found.from,
							found.to,
							found.links.some((link) => link.redrawn),
						);
		changes.push({
			kind,
			realigned: found.links.some((link) => link.realigned),
			...found,
		});
	}
	return changes.sort(
		(a, b) =>
			compareText(a.from[0]?.code ?? "", b.from[0]?.code ?? "") ||
			compareText(a.to[0]?.code ?? "", b.to[0]?.code ?? ""),
	);
}
