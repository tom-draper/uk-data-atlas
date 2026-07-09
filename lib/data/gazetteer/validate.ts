// Build-time invariants (design doc 6.1). Returns a list of violations;
// an empty list means the artifact is sound.
import type { Crosswalk, GazetteerCore } from "./types";

export interface ValidationResult {
	errors: string[]; // must be empty to ship
	warnings: string[]; // known debt, non-blocking
}

export function validateCore(
	core: GazetteerCore,
	locations: Record<string, { lad_codes: string[] }>,
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const codes = new Set(Object.keys(core.byCode));

	// Every declared parent resolves to a known entry.
	for (const e of Object.values(core.byCode))
		for (const p of e.parents)
			if (!codes.has(p))
				errors.push(`entry ${e.code} has unknown parent ${p}`);

	// nameIndex points only at real codes.
	for (const [name, cs] of Object.entries(core.nameIndex))
		for (const c of cs)
			if (!codes.has(c)) errors.push(`nameIndex[${name}] -> unknown code ${c}`);

	// areaM2 rolls up: a region's area equals the sum of its child LAD areas.
	const childArea: Record<string, number> = {};
	for (const e of Object.values(core.byCode))
		for (const p of e.parents) childArea[p] = (childArea[p] ?? 0) + e.areaM2;
	for (const e of Object.values(core.byCode)) {
		if (e.level !== "region") continue;
		const summed = childArea[e.code] ?? 0;
		if (summed > 0 && Math.abs(e.areaM2 - summed) / e.areaM2 > 0.001)
			errors.push(`region ${e.code} areaM2 ${e.areaM2} != child sum ${summed}`);
	}

	// namedLocations reproduce LOCATIONS exactly (regression guard).
	for (const [name, loc] of Object.entries(locations)) {
		const got = core.namedLocations[name];
		if (!got) {
			errors.push(`namedLocations missing ${name}`);
			continue;
		}
		if (got.memberCodes.join(",") !== loc.lad_codes.join(","))
			errors.push(`namedLocations[${name}] members differ from LOCATIONS`);
		// A member with no matching boundary in any shipped vintage is LOCATIONS
		// curation debt (a pre-2016 recoded/abolished LAD), not a gazetteer fault.
		for (const c of loc.lad_codes)
			if (!codes.has(c))
				warnings.push(`namedLocations[${name}] member ${c} predates shipped boundaries`);
	}

	return { errors, warnings };
}

export function validateCrosswalk(name: string, cw: Crosswalk, targetCodes: Set<string>): string[] {
	const errors: string[] = [];
	for (const [src, tgts] of Object.entries(cw)) {
		const sum = tgts.reduce((s, t) => s + t.weight, 0);
		if (Math.abs(sum - 1) > 0.01)
			errors.push(`${name}: weights for ${src} sum to ${sum.toFixed(3)}`);
		for (const t of tgts)
			if (!targetCodes.has(t.code))
				errors.push(`${name}: ${src} -> unknown target ${t.code}`);
	}
	return errors;
}
