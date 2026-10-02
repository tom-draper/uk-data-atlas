import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	GEOMETRY_SUBSTITUTIONS,
	REVERSED_GRID_OFFSETS,
	type GeometrySubstitution,
	type ReversedGridOffset,
} from "@uk-data-atlas/geography";
import type { GeoJsonGeometry, GeometrySourceLookup } from "./areaGeometry";
import { releaseKey } from "./geographyKeys";
import {
	appliesTo,
	offsetGeometry,
	readGridOffset,
	reverseOffsetGeometry,
	type GridOffset,
} from "./gridOffset";
import { fromWgs84Geometry, toWgs84Geometry } from "./reprojection";

export type { GeometrySubstitution };

/** One substitution, with the donor areas it supplies in WGS84. */
export type LoadedSubstitution = {
	substitution: GeometrySubstitution;
	donor: { release: string; input: string; inputHash: string };
	geometries: Map<string, GeoJsonGeometry>;
};

export const geometrySubstitution = (id: string): GeometrySubstitution => {
	const substitution = GEOMETRY_SUBSTITUTIONS.find(
		(candidate) => candidate.id === id,
	);
	if (!substitution)
		throw new Error(`No geometry substitution is defined as ${id}.`);
	return substitution;
};

type Collection = {
	type?: unknown;
	features?: Array<{ properties?: unknown; geometry?: unknown }>;
};

/**
 * Reads the donor areas a release's substitutions name, corrected and
 * reprojected as the donor release itself would be served, and checks that
 * the target release holds exactly the same covered codes, so a release is
 * never served as a mixture of the two.
 */
export const loadSubstitutions = (
	repositoryRoot: string,
	sources: GeometrySourceLookup,
	identity: string,
	ids: readonly string[],
	targetCodes: Iterable<string>,
): LoadedSubstitution[] => {
	const codes = [...targetCodes];
	return ids.map((id) => {
		const substitution = geometrySubstitution(id);
		const donorIdentity = releaseKey(
			substitution.donor.geography,
			substitution.donor.boundaryRelease,
		);
		const donor = sources.get(donorIdentity);
		if (!donor)
			throw new Error(
				`${identity}: ${id} takes areas from ${donorIdentity}, which has no geometry source.`,
			);
		if (donor.input.toLowerCase().endsWith(".shp"))
			throw new Error(
				`${identity}: ${id} takes areas from a Shapefile, which is not supported.`,
			);
		const content = readFileSync(join(repositoryRoot, "data", donor.input));
		const collection = JSON.parse(content.toString("utf8")) as Collection;
		if (
			collection.type !== "FeatureCollection" ||
			!Array.isArray(collection.features)
		)
			throw new Error(`${donorIdentity} is not a FeatureCollection.`);
		const offsets = (donor.corrections ?? []).map((correction) =>
			readGridOffset(repositoryRoot, correction),
		);
		const geometries = new Map<string, GeoJsonGeometry>();
		for (const feature of collection.features) {
			const props = feature.properties as Record<string, unknown> | null;
			const code = props?.[donor.codeProperty];
			if (
				typeof code !== "string" ||
				!code.startsWith(substitution.codePrefix) ||
				typeof feature.geometry !== "object" ||
				feature.geometry === null
			)
				continue;
			if (geometries.has(code))
				throw new Error(
					`${donorIdentity}: ${id} expects one feature per code, but ${code} repeats.`,
				);
			const corrected = offsets
				.filter((offset) => appliesTo(offset, code))
				.reduce(
					(geometry, offset) => offsetGeometry(offset, geometry),
					feature.geometry as GeoJsonGeometry,
				);
			geometries.set(code, toWgs84Geometry(corrected, donor.crs));
		}
		const covered = new Set(
			codes.filter((code) => code.startsWith(substitution.codePrefix)),
		);
		const unmatched = [
			...[...covered].filter((code) => !geometries.has(code)),
			...[...geometries.keys()].filter((code) => !covered.has(code)),
		].sort();
		if (covered.size === 0 || unmatched.length > 0)
			throw new Error(
				`${identity}: ${id} needs the same ${substitution.codePrefix} codes as ${donorIdentity}; ${
					covered.size === 0
						? "the release has none"
						: `unmatched: ${unmatched.join(", ")}`
				}.`,
			);
		return {
			substitution,
			donor: {
				release: donorIdentity,
				input: donor.input,
				inputHash:
					donor.inputHash ??
					`sha256:${createHash("sha256").update(content).digest("hex")}`,
			},
			geometries,
		};
	});
};

/**
 * The substitutions that replaced one area, or with no code every one the
 * release declares, described as geometry provenance lists corrections: what
 * was done, and the donor file it came from.
 */
export const substitutionProvenance = (
	sources: GeometrySourceLookup,
	ids: readonly string[],
	code?: string,
) =>
	ids
		.map(geometrySubstitution)
		.filter(
			(substitution) =>
				code === undefined || code.startsWith(substitution.codePrefix),
		)
		.map((substitution) => {
			const donor = sources.get(
				releaseKey(
					substitution.donor.geography,
					substitution.donor.boundaryRelease,
				),
			);
			return {
				id: substitution.id,
				description: donor
					? `${substitution.description} Source: ${donor.input}${donor.inputHash ? ` (${donor.inputHash})` : ""}.`
					: substitution.description,
			};
		});

export const reversedGridOffset = (id: string): ReversedGridOffset => {
	const reversed = REVERSED_GRID_OFFSETS.find(
		(candidate) => candidate.id === id,
	);
	if (!reversed)
		throw new Error(`No reversed grid offset is defined as ${id}.`);
	return reversed;
};

const offsets = new Map<string, GridOffset>();
const gridOffset = (repositoryRoot: string, id: string) => {
	const key = `${repositoryRoot}\u0000${id}`;
	let offset = offsets.get(key);
	if (!offset) {
		offset = readGridOffset(repositoryRoot, id);
		offsets.set(key, offset);
	}
	return offset;
};

/**
 * Undoes the grid offsets a WGS84 release carries backwards, for one area:
 * into the offset's grid, back by its exact inverse, and into WGS84 again.
 */
export const applyReversedOffsets = <T extends GeoJsonGeometry>(
	repositoryRoot: string,
	ids: readonly string[],
	code: string,
	geometry: T,
): T =>
	ids
		.map(reversedGridOffset)
		.filter((reversed) => code.startsWith(reversed.codePrefix))
		.reduce((moved, reversed) => {
			const offset = gridOffset(repositoryRoot, reversed.offset);
			return toWgs84Geometry(
				reverseOffsetGeometry(
					offset,
					fromWgs84Geometry(moved, offset.crs),
				),
				offset.crs,
			);
		}, geometry);

/** The reversed offsets that moved one area, or with no code all of them. */
export const reversedOffsetProvenance = (
	ids: readonly string[],
	code?: string,
) =>
	ids
		.map(reversedGridOffset)
		.filter(
			(reversed) =>
				code === undefined || code.startsWith(reversed.codePrefix),
		)
		.map(({ id, description }) => ({ id, description }));
