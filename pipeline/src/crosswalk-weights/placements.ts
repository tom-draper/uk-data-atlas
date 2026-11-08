import { sha256 } from "@uk-data-atlas/artifacts";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placeInRelease, releasesWithGeometry } from "./placement.ts";
import type { WeightAtoms } from "./atoms.ts";
import type { Placement } from "./weigh.ts";

/**
 * Placements of the atoms in releases, kept as files (an Int32 index into the
 * release's codes for each atom, and the codes) so a release is placed again
 * only when its geometry or the atoms change. They are intermediates.
 */

/** A hash of where the atoms are, which every placement is keyed by. */
export const atomsKey = (
	atoms: Pick<WeightAtoms, "longitude" | "latitude">,
) => {
	const hash = createHash("sha256");
	for (const values of [atoms.longitude, atoms.latitude])
		hash.update(
			new Uint8Array(values.buffer, values.byteOffset, values.byteLength),
		);
	return hash.digest("hex");
};

const fileOf = (
	directory: string,
	geography: string,
	boundaryRelease: string,
) => join(directory, `${geography}__${boundaryRelease}.i32`);

const placementKey = (key: string, geometryInput: string) =>
	sha256(`${key}\n${geometryInput}`);

/** The placement a directory holds for a release, if it is of these atoms and this geometry. */
export const readPlacement = (
	directories: readonly string[],
	geography: string,
	boundaryRelease: string,
	expected?: { atomsKey: string; geometryInput: string },
): Placement | undefined => {
	for (const directory of directories) {
		const file = fileOf(directory, geography, boundaryRelease);
		if (!existsSync(`${file}.json`) || !existsSync(file)) continue;
		const meta = JSON.parse(readFileSync(`${file}.json`, "utf8")) as {
			key: string;
			codes: string[];
		};
		if (
			expected &&
			meta.key !== placementKey(expected.atomsKey, expected.geometryInput)
		)
			continue;
		const bytes = readFileSync(file);
		return {
			codes: meta.codes,
			area: new Int32Array(
				bytes.buffer.slice(
					bytes.byteOffset,
					bytes.byteOffset + bytes.byteLength,
				),
			),
		};
	}
	return undefined;
};

/**
 * Place the atoms in each release, one at a time, unless a directory already
 * holds a current placement. New placements go in `directories[0]`.
 */
export const ensurePlacements = async (
	root: string,
	atoms: Pick<WeightAtoms, "longitude" | "latitude">,
	releases: ReadonlyArray<{ geography: string; boundaryRelease: string }>,
	directories: readonly string[],
	{
		rebuild = false,
		onPlaced,
	}: {
		rebuild?: boolean;
		onPlaced?: (
			release: { geography: string; boundaryRelease: string },
			seconds: number | undefined,
		) => void;
	} = {},
) => {
	const key = atomsKey(atoms);
	const geometryInput = releasesWithGeometry(root);
	const longitudes = new Float64Array(
		new SharedArrayBuffer(atoms.longitude.byteLength),
	);
	longitudes.set(atoms.longitude);
	const latitudes = new Float64Array(
		new SharedArrayBuffer(atoms.latitude.byteLength),
	);
	latitudes.set(atoms.latitude);
	mkdirSync(directories[0]!, { recursive: true });
	for (const release of releases) {
		const input = geometryInput(release.geography, release.boundaryRelease);
		if (input === undefined)
			throw new Error(
				`No geometry for ${release.geography}/${release.boundaryRelease}`,
			);
		const expected = { atomsKey: key, geometryInput: input };
		if (
			!rebuild &&
			readPlacement(
				directories,
				release.geography,
				release.boundaryRelease,
				expected,
			)
		) {
			onPlaced?.(release, undefined);
			continue;
		}
		const result = await placeInRelease({
			root,
			geography: release.geography,
			boundaryRelease: release.boundaryRelease,
			longitudes: longitudes.buffer as SharedArrayBuffer,
			latitudes: latitudes.buffer as SharedArrayBuffer,
		});
		const file = fileOf(
			directories[0]!,
			release.geography,
			release.boundaryRelease,
		);
		writeFileSync(
			file,
			new Uint8Array(
				result.area.buffer,
				result.area.byteOffset,
				result.area.byteLength,
			),
		);
		writeFileSync(
			`${file}.json`,
			JSON.stringify({
				key: placementKey(key, input),
				atomsKey: key,
				codes: result.codes,
			}),
		);
		onPlaced?.(release, result.seconds);
	}
};

export const placementFilesOutside = (
	names: readonly string[],
	keep: ReadonlySet<string>,
	directory: string,
) =>
	names
		.map((name) => join(directory, name))
		.filter((path) => !keep.has(path));

export const placementFile = fileOf;
