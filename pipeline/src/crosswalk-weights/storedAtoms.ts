import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MEASURES, type Measure, type WeightAtoms } from "./atoms.ts";
import { atomsKey } from "./placements.ts";

/**
 * The measures of the atoms, kept by the `weight-atoms` stage for the
 * `postcode-overlap` crosswalks to be compiled from, with the key of the
 * atoms they belong to. Coordinates are not kept: the placements hold where
 * each atom lies.
 */
export const weightAtomsDirectory = (root: string) =>
	join(root, "data/build/weight-atoms");

export type StoredAtoms = {
	key: string;
	count: number;
	postcodes: number;
	outputAreas: number;
	totals: WeightAtoms["totals"];
	measures: Record<Measure, Float64Array>;
};

export const writeStoredAtoms = (root: string, atoms: WeightAtoms) => {
	const directory = weightAtomsDirectory(root);
	mkdirSync(directory, { recursive: true });
	const measures = new Float64Array(atoms.count * MEASURES.length);
	for (const [at, name] of MEASURES.entries())
		measures.set(atoms.measures[name], at * atoms.count);
	const bytes = new Uint8Array(
		measures.buffer,
		measures.byteOffset,
		measures.byteLength,
	);
	writeFileSync(join(directory, "measures.f64.tmp"), bytes);
	renameSync(
		join(directory, "measures.f64.tmp"),
		join(directory, "measures.f64"),
	);
	writeFileSync(
		join(directory, "atoms.json.tmp"),
		JSON.stringify({
			key: atomsKey(atoms),
			count: atoms.count,
			postcodes: atoms.postcodes,
			outputAreas: atoms.count - atoms.postcodes,
			totals: atoms.totals,
		}),
	);
	renameSync(
		join(directory, "atoms.json.tmp"),
		join(directory, "atoms.json"),
	);
};

export const readStoredAtoms = (root: string): StoredAtoms => {
	const directory = weightAtomsDirectory(root);
	const meta = JSON.parse(
		readFileSync(join(directory, "atoms.json"), "utf8"),
	) as Omit<StoredAtoms, "measures">;
	const bytes = readFileSync(join(directory, "measures.f64"));
	const all = new Float64Array(
		bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		),
	);
	if (all.length !== meta.count * MEASURES.length)
		throw new Error("The stored weight atoms are incomplete");
	return {
		...meta,
		measures: Object.fromEntries(
			MEASURES.map((name, at) => [
				name,
				all.subarray(at * meta.count, (at + 1) * meta.count),
			]),
		) as Record<Measure, Float64Array>,
	};
};
