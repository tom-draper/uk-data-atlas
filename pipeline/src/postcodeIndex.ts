import { compareCodeUnits } from "../../shared/compareCodeUnits";
import { sha256 } from "../../shared/contentHash";
import {
	COUNTRY_CODES,
	NORTHERN_IRELAND_EXCLUSION,
	parsePostcode,
	QUALITY,
} from "@uk-data-atlas/geography";
import type {
	PostcodeIndexArtifact,
	PostcodeSource,
	PostcodeShard,
} from "@uk-data-atlas/geography/postcode-index-types";

/** The fields of one directory row the index is compiled from. */
export type PostcodeSourceRow = {
	pcds: string;
	dointr: string;
	doterm: string;
	usrtypind: string;
	east1m: string;
	north1m: string;
	gridind: string;
	ctry: string;
};

const monthNumber = (text: string, field: string, postcode: string) => {
	if (!/^\d{6}$/.test(text))
		throw new Error(
			`${postcode}: ${field} ${JSON.stringify(text)} is not YYYYMM`,
		);
	return Number(text);
};

/**
 * Compile directory rows into shard files and the manifest that pins them.
 * Northern Ireland is left out unless `includeNorthernIreland` is set, for a
 * build that will not be served publicly.
 */
export const compilePostcodeIndex = (
	rows: Iterable<PostcodeSourceRow>,
	source: PostcodeSource,
	options: { includeNorthernIreland?: boolean } = {},
): {
	artifact: PostcodeIndexArtifact;
	files: Array<{ path: string; text: string }>;
} => {
	type Entry = {
		compact: string;
		grid: [number, number] | null;
		quality: string;
		country: string;
		introduced: number;
		terminated: number;
		largeUser: boolean;
	};
	const byDistrict = new Map<string, Entry[]>();
	const excluded = new Map<string, number>();
	for (const row of rows) {
		const parsed = parsePostcode(row.pcds);
		if (parsed?.kind !== "unit" || parsed.display !== row.pcds)
			throw new Error(
				`${JSON.stringify(row.pcds)} is not a unit postcode`,
			);
		const country = row.ctry.charAt(0);
		if (!(country in COUNTRY_CODES))
			throw new Error(`${row.pcds}: unknown country ${row.ctry}`);
		if (country === "N" && !options.includeNorthernIreland) {
			excluded.set(parsed.area, (excluded.get(parsed.area) ?? 0) + 1);
			continue;
		}
		if (!(row.gridind in QUALITY))
			throw new Error(`${row.pcds}: unknown gridind ${row.gridind}`);
		const hasGrid = row.gridind !== "9";
		if (hasGrid !== (row.east1m !== "" && row.north1m !== ""))
			throw new Error(
				`${row.pcds}: gridind ${row.gridind} disagrees with its grid reference`,
			);
		const entries = byDistrict.get(parsed.district) ?? [];
		byDistrict.set(parsed.district, entries);
		entries.push({
			compact: parsed.compact,
			grid: hasGrid ? [Number(row.east1m), Number(row.north1m)] : null,
			quality: row.gridind,
			country,
			introduced: monthNumber(row.dointr, "dointr", row.pcds),
			terminated:
				row.doterm === ""
					? 0
					: monthNumber(row.doterm, "doterm", row.pcds),
			largeUser: row.usrtypind === "1",
		});
	}
	const counts = {
		postcodes: 0,
		live: 0,
		terminated: 0,
		withoutGridReference: 0,
	};
	const files: Array<{ path: string; text: string }> = [];
	const shards: PostcodeIndexArtifact["shards"] = [];
	for (const district of [...byDistrict.keys()].sort(compareCodeUnits)) {
		const entries = byDistrict
			.get(district)!
			.sort((left, right) =>
				compareCodeUnits(left.compact, right.compact),
			);
		for (let at = 1; at < entries.length; at += 1)
			if (entries[at]!.compact === entries[at - 1]!.compact)
				throw new Error(`${entries[at]!.compact} appears twice`);
		const shard: PostcodeShard = {
			schemaVersion: 1,
			district,
			postcodes: entries.map((entry) => entry.compact),
			grid: entries.flatMap((entry) => entry.grid ?? [null, null]),
			quality: entries.map((entry) => entry.quality).join(""),
			country: entries.map((entry) => entry.country).join(""),
			introduced: entries.map((entry) => entry.introduced),
			terminated: entries.map((entry) => entry.terminated),
			largeUser: entries
				.map((entry) => (entry.largeUser ? "1" : "0"))
				.join(""),
		};
		const text = `${JSON.stringify(shard)}\n`;
		const path = `postcodes/${/^[A-Z]+/.exec(district)![0]}/${district}.json`;
		files.push({ path, text });
		shards.push({
			district,
			path,
			postcodes: entries.length,
			contentHash: sha256(text),
		});
		for (const entry of entries) {
			counts.postcodes += 1;
			if (entry.terminated) counts.terminated += 1;
			else counts.live += 1;
			if (!entry.grid) counts.withoutGridReference += 1;
		}
	}
	const body = {
		schemaVersion: 1 as const,
		source,
		excluded: [...excluded.entries()]
			.sort(([left], [right]) => compareCodeUnits(left, right))
			.map(([area, postcodes]) => ({
				area,
				postcodes,
				reason: NORTHERN_IRELAND_EXCLUSION,
			})),
		counts,
		shards,
	};
	return {
		artifact: { ...body, contentHash: sha256(JSON.stringify(body)) },
		files,
	};
};
