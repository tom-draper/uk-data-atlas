import { readFile } from "node:fs/promises";
import { decodeBoundaryData } from "@uk-data-atlas/datasets/data/boundaries/decode";
import {
	applyGridOffset,
	substituteFeatures,
	type GeometrySubstitution,
	type GridOffset,
} from "@uk-data-atlas/geography";
import { applyReversedGridOffset } from "@uk-data-atlas/geography";
import type { SubstitutionSource } from "./boundaryReleaseSources.ts";

/**
 * Decodes a published source into WGS84. Grid corrections work in the
 * publisher's grid, so they run before decoding reprojects it.
 */
const decodeCorrected = (
	raw: string,
	label: string,
	codeKey: string,
	offsets: readonly GridOffset[],
) =>
	decodeBoundaryData(
		offsets.reduce(
			(collection, offset) =>
				applyGridOffset(collection, offset, codeKey, label),
			JSON.parse(raw),
		),
	);

export type SourceCorrection = {
	label: string;
	codeKey: string;
	offsets: GridOffset[];
	substitutions: SubstitutionSource[];
	reversedOffsets: GridOffset[];
};

/**
 * A release's published source in WGS84, with every correction it declares
 * applied: grid offsets, offsets carried backwards and substituted areas. The
 * TopoJSON and the vector tiles are both compiled from this.
 */
export const correctedSource = async (
	raw: string,
	correction: SourceCorrection,
) => {
	let normalised = decodeCorrected(
		raw,
		correction.label,
		correction.codeKey,
		correction.offsets,
	);
	// Offsets carried backwards are undone once the release is in WGS84.
	for (const offset of correction.reversedOffsets)
		normalised = applyReversedGridOffset(
			normalised,
			offset,
			correction.codeKey,
			correction.label,
		);
	// Substituted areas are swapped in once both releases are in WGS84.
	for (const donor of correction.substitutions)
		normalised = substituteFeatures(
			normalised,
			correction.codeKey,
			decodeCorrected(
				await readFile(donor.sourcePath, "utf8"),
				donor.label,
				donor.codeKey,
				donor.offsets,
			),
			donor.codeKey,
			donor.substitution satisfies GeometrySubstitution,
			correction.label,
		);
	return normalised;
};
