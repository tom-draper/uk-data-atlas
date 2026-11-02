import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { csvFields } from "@uk-data-atlas/artifacts";
import type {
	StatisticsInput,
	StatisticsObservation,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	CENSUS_SMALL_AREA_TABLES,
	type CensusTable,
} from "./catalog/censusSmallArea";

const geographies = ["lsoa", "msoa"] as const;

/** Read one CSV line at a time, keeping the source file out of the Node heap. */
function* lines(path: string): Generator<string> {
	const fd = openSync(path, "r");
	const buffer = Buffer.alloc(64 * 1024);
	const decoder = new StringDecoder("utf8");
	let pending = "";
	try {
		let size: number;
		while ((size = readSync(fd, buffer, 0, buffer.length, null)) !== 0) {
			pending += decoder.write(buffer.subarray(0, size));
			let end: number;
			while ((end = pending.indexOf("\n")) !== -1) {
				yield pending.slice(0, end).replace(/\r$/, "");
				pending = pending.slice(end + 1);
			}
		}
		pending += decoder.end();
		if (pending) yield pending.replace(/\r$/, "");
	} finally {
		closeSync(fd);
	}
}

function fingerprint(paths: string[]): string {
	const hash = createHash("sha256");
	for (const path of paths) {
		const fd = openSync(path, "r");
		const buffer = Buffer.alloc(64 * 1024);
		try {
			let size: number;
			while ((size = readSync(fd, buffer, 0, buffer.length, null)) !== 0)
				hash.update(buffer.subarray(0, size));
		} finally {
			closeSync(fd);
		}
	}
	return hash.digest("hex");
}

export function censusStatistics(
	directory: string,
	tables: readonly CensusTable[] = CENSUS_SMALL_AREA_TABLES,
): StatisticsInput[] {
	return tables.map((table) => {
		const root = join(directory, table.table);
		const paths = geographies.map((geo) =>
			join(root, `census2021-${table.table}-${geo}.csv`),
		);
		const metaPath = join(root, "meta.json");
		const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
			title: string;
			description: string;
			publisher: string;
			sourceUrl: string;
			licence: { name: string; url?: string };
		};
		const slug = `census-2021-${table.table}`;
		const measure = `${slug}-count`;
		const dimension = `${slug}-category`;
		const hash = fingerprint([metaPath, ...paths]);
		return (areas) => ({
			slug,
			title: meta.title,
			description: meta.description,
			source: {
				publisher: meta.publisher,
				url: meta.sourceUrl,
				licence: meta.licence.name,
				licenceUrl: meta.licence.url,
			},
			fingerprint: hash,
			measures: [
				{
					slug: measure,
					label: meta.title,
					description: table.universe,
					unit: table.unit,
					valueKind: "count",
					aggregation: "sum",
				},
			],
			dimensions: [
				{
					slug: dimension,
					label: meta.title,
					members: table.categories.map(([code, , label]) => ({
						code,
						label,
					})),
				},
			],
			periods: [
				{
					label: "2021",
					kind: "year",
					start: "2021-01-01",
					end: "2021-12-31",
				},
			],
			series: geographies.flatMap((geography) =>
				table.categories.map(([code]) => ({
					measure,
					release: areas.release(geography, 2021),
					members: { [dimension]: code },
				})),
			),
			*observations(): Generator<StatisticsObservation> {
				for (const [geoIndex, path] of paths.entries()) {
					const input = lines(path);
					const header = csvFields(
						(input.next().value ?? "").replace(/^\uFEFF/, ""),
					);
					if (
						["date", "geography", "geography code"].some(
							(name, i) => header[i] !== name,
						)
					) {
						input.return(undefined);
						throw new Error(`${path}: invalid header`);
					}
					const columns = table.categories.map(([, name]) =>
						header.indexOf(name),
					);
					const total = header.indexOf(table.totalColumn);
					if (total < 0 || columns.includes(-1)) {
						input.return(undefined);
						throw new Error(`${path}: missing census column`);
					}
					let row = 1;
					for (const line of input) {
						row++;
						if (!line) continue;
						const fields = csvFields(line);
						const code = fields[2] ?? "";
						const prefixes =
							geoIndex === 0 ? ["E01", "W01"] : ["E02", "W02"];
						if (
							fields[0] !== "2021" ||
							!prefixes.some((prefix) => code.startsWith(prefix))
						)
							throw new Error(
								`${path}:${row}: invalid date or area code`,
							);
						const value = (column: number) => {
							const raw = fields[column];
							if (raw === undefined || !/^\d+$/.test(raw))
								throw new Error(
									`${path}:${row}: invalid count`,
								);
							const count = Number(raw);
							if (!Number.isSafeInteger(count))
								throw new Error(
									`${path}:${row}: invalid count`,
								);
							return count;
						};
						const sum = table.categories.reduce(
							(n, [, name], index) =>
								n +
								(name === table.totalColumn
									? 0
									: value(columns[index]!)),
							0,
						);
						if (sum !== value(total))
							throw new Error(
								`${path}:${row}: categories do not sum to total`,
							);
						for (const [index, column] of columns.entries())
							yield {
								series: geoIndex * columns.length + index,
								code,
								period: "2021",
								value: value(column),
							};
					}
				}
			},
		});
	});
}
