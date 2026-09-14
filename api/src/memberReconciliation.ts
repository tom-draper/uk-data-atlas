import type { AreaLookup } from "./areaInventory";

/**
 * Why a member code does not resolve in the requested boundary release.
 *
 * The classification is relative to that release, not absolute: a code that is
 * `superseded` against a 2023 release is current against a 2021 one. It is
 * decided purely by which compiled releases contain the code, so it reports
 * code membership and never asserts anything about geometry.
 */
export type MemberCodeStatus =
	/** Only in releases older than the requested one. */
	| "superseded"
	/** Only in releases newer than the requested one. */
	| "not-yet-current"
	/** In older and newer releases, or the dates cannot be compared. */
	| "absent-from-release"
	/** In no compiled release of this geography. */
	| "unknown";

export type UnresolvedMember = {
	code: string;
	status: MemberCodeStatus;
	/** The name the code carries in the releases that do contain it. */
	name?: string;
	presentIn: string[];
};

export type MemberCoverage = {
	memberCodeCount: number;
	resolvedCount: number;
	unresolvedCount: number;
	complete: boolean;
	/**
	 * Whether every code that did not resolve is accounted for by the vintage
	 * asked for rather than by an error. A curated location lists every code it
	 * has ever been made of, so against any one release some of them are always
	 * the wrong vintage; that is the list working, not a gap in it.
	 */
	coversLocation: boolean;
	unexplained: UnresolvedMember[];
	/**
	 * Codes naming no area in any compiled release: legacy aliases a curated
	 * location keeps so that a dataset published under the old code still
	 * matches. They resolve to nothing here, so they add nothing and hide
	 * nothing, but they are listed rather than passed over.
	 */
	legacy: UnresolvedMember[];
	unresolved: UnresolvedMember[];
	note: string;
};

/**
 * An absence the requested vintage explains. A code only in older releases has
 * been superseded by one already in the list, and a code only in newer ones has
 * yet to take effect; in both cases the successor or predecessor resolves in
 * its place, so the location still covers the same ground. Anything else is an
 * error in the definition: a code in no compiled release at all, or one whose
 * appearances straddle the release asked for.
 */
const EXPLAINED: MemberCodeStatus[] = ["superseded", "not-yet-current"];

/**
 * A code in no compiled release at all. It cannot be placed in time, so it
 * cannot be said to be covered by a successor; but it also matched nothing, so
 * it contributed nothing to any sum and cannot have been counted twice. It is
 * reported rather than treated as a gap.
 */
const LEGACY: MemberCodeStatus = "unknown";

const COVERAGE_NOTE =
	"Coverage compares member codes against compiled area releases only. An unresolved code is not a claim that the place is missing, and a resolved one is not a claim of equal geometry. `complete` means every listed code resolved, which a location spanning several vintages never does; `coversLocation` is the one to read, and means every code that did not resolve was either the wrong vintage for this release or a legacy alias naming no compiled area, rather than an unexplained absence. Codes of the second kind are listed separately in `legacy`.";

/** Releases are identified by a `YYYY-MM` prefix; anything else is unordered. */
const releaseOrder = (boundaryRelease: string): number | undefined => {
	const match = /^(\d{4})-(\d{2})/.exec(boundaryRelease);
	return match ? Number(match[1]) * 12 + Number(match[2]) : undefined;
};

type Appearance = { boundaryRelease: string; name: string };

const appearances = (
	areaLookup: AreaLookup,
	geography: string,
	code: string,
): Appearance[] => {
	const prefix = `${geography}/`;
	const found: Appearance[] = [];
	for (const [key, areas] of areaLookup) {
		if (!key.startsWith(prefix)) continue;
		const area = areas.get(code);
		if (area) {
			found.push({
				boundaryRelease: key.slice(prefix.length),
				name: area.name,
			});
		}
	}
	return found.sort((left, right) =>
		left.boundaryRelease.localeCompare(right.boundaryRelease),
	);
};

const statusFor = (
	found: Appearance[],
	target: number | undefined,
): MemberCodeStatus => {
	if (found.length === 0) return "unknown";
	if (target === undefined) return "absent-from-release";
	const orders = found.map((appearance) =>
		releaseOrder(appearance.boundaryRelease),
	);
	if (orders.some((order) => order === undefined))
		return "absent-from-release";
	const known = orders as number[];
	if (known.every((order) => order < target)) return "superseded";
	if (known.every((order) => order > target)) return "not-yet-current";
	return "absent-from-release";
};

/**
 * Explain a named location's membership against one boundary release.
 *
 * The curated locations predate the compiled releases and carry codes from
 * several vintages, so a bare list of unresolved codes cannot be acted on: a
 * caller cannot tell an abolished district from a recode it has yet to adopt,
 * or from a typo. This reports which, and the releases that are the evidence.
 */
const coverageFor = (
	areaLookup: AreaLookup,
	geography: string,
	target: number | undefined,
	memberCodes: string[],
	resolvedCodes: Set<string>,
): MemberCoverage => {
	const unresolved = memberCodes
		.filter((code) => !resolvedCodes.has(code))
		.map((code) => {
			const found = appearances(areaLookup, geography, code);
			return {
				code,
				status: statusFor(found, target),
				...(found[0] ? { name: found[0].name } : {}),
				presentIn: found.map(
					(appearance) => appearance.boundaryRelease,
				),
			};
		});
	const legacy = unresolved.filter((member) => member.status === LEGACY);
	const unexplained = unresolved.filter(
		(member) =>
			!EXPLAINED.includes(member.status) && member.status !== LEGACY,
	);
	return {
		memberCodeCount: memberCodes.length,
		resolvedCount: memberCodes.length - unresolved.length,
		unresolvedCount: unresolved.length,
		complete: unresolved.length === 0,
		// Nothing resolving is not coverage, however well the absences are
		// explained: a district abolished before the release asked for leaves
		// no area behind it, and a location carrying no codes at all names an
		// extent rather than a set of areas.
		coversLocation:
			unexplained.length === 0 &&
			memberCodes.length - unresolved.length > 0,
		legacy,
		unexplained,
		unresolved,
		note: COVERAGE_NOTE,
	};
};

export const reconcileMembers = (
	areaLookup: AreaLookup,
	geography: string,
	boundaryRelease: string,
	memberCodes: string[],
	resolvedCodes: Set<string>,
): MemberCoverage =>
	coverageFor(
		areaLookup,
		geography,
		releaseOrder(boundaryRelease),
		memberCodes,
		resolvedCodes,
	);

/**
 * The same reconciliation against a source partition, which names the vintage
 * of its codes by year rather than by a release id. Mid-year stands for the
 * year, so a release from either half of it orders the same way.
 */
export const reconcileMembersForYear = (
	areaLookup: AreaLookup,
	geography: string,
	boundaryYear: number,
	memberCodes: string[],
	resolvedCodes: Set<string>,
): MemberCoverage =>
	coverageFor(
		areaLookup,
		geography,
		boundaryYear * 12 + 6,
		memberCodes,
		resolvedCodes,
	);
