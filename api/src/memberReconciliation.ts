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
	unresolved: UnresolvedMember[];
	note: string;
};

const COVERAGE_NOTE =
	"Coverage compares member codes against compiled area releases only. An unresolved code is not a claim that the place is missing, and a resolved one is not a claim of equal geometry.";

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
	boundaryRelease: string,
): MemberCodeStatus => {
	if (found.length === 0) return "unknown";
	const target = releaseOrder(boundaryRelease);
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
export const reconcileMembers = (
	areaLookup: AreaLookup,
	geography: string,
	boundaryRelease: string,
	memberCodes: string[],
	resolvedCodes: Set<string>,
): MemberCoverage => {
	const unresolved = memberCodes
		.filter((code) => !resolvedCodes.has(code))
		.map((code) => {
			const found = appearances(areaLookup, geography, code);
			return {
				code,
				status: statusFor(found, boundaryRelease),
				...(found[0] ? { name: found[0].name } : {}),
				presentIn: found.map(
					(appearance) => appearance.boundaryRelease,
				),
			};
		});
	return {
		memberCodeCount: memberCodes.length,
		resolvedCount: memberCodes.length - unresolved.length,
		unresolvedCount: unresolved.length,
		complete: unresolved.length === 0,
		unresolved,
		note: COVERAGE_NOTE,
	};
};
