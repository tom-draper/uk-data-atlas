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
