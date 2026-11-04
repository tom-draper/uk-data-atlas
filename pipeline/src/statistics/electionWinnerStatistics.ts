import { closeSync, openSync, readSync } from "node:fs";
import { JSONParser } from "@streamparser/json";
import {
	seriesKey,
	type AreaIndex,
	type DeclaredDataset,
	type StatisticsDataset,
	type StatisticsObservation,
} from "@uk-data-atlas/atlas-runtime/catalogue";

const codes = [
	"APNI",
	"CON",
	"DUP",
	"GREEN",
	"IND",
	"LAB",
	"LD",
	"OTHER",
	"PC",
	"REF",
	"RUK",
	"SDLP",
	"SF",
	"SNP",
	"SPK",
	"TUV",
	"UKIP",
	"UUP",
];

function* results(path: string): Generator<{
	year: string;
	code: string;
	category: string;
	header: Record<string, string | number>;
}> {
	const parser = new JSONParser({
		paths: [
			"$.*.year",
			"$.*.boundaryYear",
			"$.*.boundaryType",
			"$.*.results.*",
		],
		keepStack: false,
	});
	const headers = new Map<string, Record<string, string | number>>();
	let ready: {
		year: string;
		code: string;
		category: string;
		header: Record<string, string | number>;
	}[] = [];
	parser.onValue = ({ key, value, stack }) => {
		const year = String(stack[1]?.key);
		const header = headers.get(year) ?? {};
		headers.set(year, header);
		if (stack.at(-1)?.key === "results") {
			if (
				typeof key !== "string" ||
				typeof value !== "string" ||
				!codes.includes(value)
			)
				throw new Error(
					`${path}: invalid winning party ${String(value)}`,
				);
			ready.push({ year, code: key, category: value, header });
		} else if (
			typeof key === "string" &&
			(typeof value === "string" || typeof value === "number")
		)
			header[key] = value;
	};
	const fd = openSync(path, "r");
	const buffer = Buffer.alloc(64 * 1024);
	try {
		let size: number;
		while ((size = readSync(fd, buffer, 0, buffer.length, null)) !== 0) {
			parser.write(buffer.subarray(0, size));
			yield* ready;
			ready = [];
		}
		if (!parser.isEnded) parser.end();
		yield* ready;
	} finally {
		closeSync(fd);
	}
}

export function electionWinnerStatistics(
	base: StatisticsDataset,
	areas: AreaIndex,
	config: DeclaredDataset,
	path: string,
): StatisticsDataset {
	const releases = [
		...new Map(
			base.series.map(({ release }) => [
				`${release.geography}:${release.id}`,
				release,
			]),
		).values(),
	];
	const added = releases.map((release) => ({
		measure: "source-winning-party",
		release,
	}));
	const observations = function* (): Generator<StatisticsObservation> {
		for (const { year, code, category, header } of results(path)) {
			const first = config.release
				? config.release(header)
				: {
						geography: String(header.boundaryType),
						year: Number(header.boundaryYear),
					};
			const rest =
				typeof config.alsoIn === "function"
					? config.alsoIn(header)
					: (config.alsoIn ?? []);
			const release = [first, ...rest]
				.map((item) => areas.find(item.geography, item.year))
				.find((item) => item && areas.has(item, code));
			if (!release)
				throw new Error(
					`${path}: no boundary release for ${year} ${code}`,
				);
			const index = releases.findIndex(
				(item) =>
					item.geography === release.geography &&
					item.id === release.id,
			);
			const period = base.periods.find((item) =>
				item.label.startsWith(`${year}-`),
			);
			if (index < 0 || !period)
				throw new Error(
					`${path}: no series or period for ${year} ${code}`,
				);
			yield {
				series: base.series.length + index,
				code,
				period: period.label,
				value: null,
				category,
			};
		}
	};
	return {
		...base,
		measures: [
			...base.measures,
			{
				slug: "source-winning-party",
				label: "Winning party",
				description: "Winning party code reported by the source.",
				unit: "party",
				valueKind: "category",
				aggregation: "none",
			},
		],
		dimensions: [
			...(base.dimensions ?? []),
			{
				slug: "winning-party-code",
				label: "Winning party code",
				members: codes.map((code) => ({ code, label: code })),
			},
		],
		categoryDimension: "winning-party-code",
		series: [...base.series, ...added],
		*observations() {
			yield* base.observations();
			yield* observations();
		},
		verify(database) {
			base.verify?.(database);
			let expected = 0;
			for (const _ of observations()) expected++;
			const keys = added.map((series) => seriesKey(base.slug, series));
			const actual = database
				.prepare(
					"SELECT count(*) AS n FROM observation o JOIN series s ON s.id = o.series_id WHERE s.key IN (SELECT value FROM json_each(?))",
				)
				.get(JSON.stringify(keys));
			if (!expected || Number(actual?.n) !== expected)
				throw new Error(
					`${base.slug}: ${Number(actual?.n)} winning party rows for ${expected} results`,
				);
			// The contests carry the same winners, from the same results.
			const differing = database
				.prepare(
					`SELECT count(*) AS n FROM observation o
					JOIN series s ON s.id = o.series_id
					JOIN dimension_member dm ON dm.id = o.category_id
					JOIN period p ON p.id = o.period_id
					LEFT JOIN election e ON e.dataset_id = s.dataset_id AND e.date = p.label
					LEFT JOIN contest c ON c.election_id = e.id AND c.area_version_id = o.area_version_id
					LEFT JOIN party w ON w.id = c.winner_party_id
					WHERE s.key IN (SELECT value FROM json_each(?)) AND w.key IS NOT dm.code`,
				)
				.get(JSON.stringify(keys));
			if (Number(differing?.n) !== 0)
				throw new Error(
					`${base.slug}: ${Number(differing?.n)} winning party rows differ from the contests' winners`,
				);
		},
	};
}
