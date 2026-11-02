import { closeSync, openSync, readSync } from "node:fs";
import { JSONParser } from "@streamparser/json";
import {
	memberCode,
	seriesKey,
	type AreaIndex,
	type DeclaredDataset,
	type StatisticsDataset,
	type StatisticsObservation,
} from "@uk-data-atlas/atlas-runtime/catalogue";

function* partnershipRecords(
	path: string,
): Generator<{ code: string; values: Record<string, unknown> }> {
	const parser = new JSONParser({
		paths: ["$.*.partnerships.*"],
		keepStack: false,
	});
	let ready: { code: string; values: Record<string, unknown> }[] = [];
	parser.onValue = ({ key, value }) => {
		if (
			typeof key !== "string" ||
			value === null ||
			typeof value !== "object" ||
			Array.isArray(value)
		)
			throw new Error(`${path}: invalid partnership record`);
		ready.push({ code: key, values: value });
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

/** Add the published partnership partition without changing the dataset's JSON layout. */
export function crimePartnershipStatistics(
	base: StatisticsDataset,
	areas: AreaIndex,
	config: DeclaredDataset,
	path: string,
): StatisticsDataset {
	const dimension = config.dimensions?.find(
		(item) => item.slug === "offence",
	);
	const members = dimension?.members;
	const measure = config.measures.find(
		(item) => item.slug === "recorded-crimes",
	);
	if (!members || !measure || base.periods.length !== 1)
		throw new Error(
			"Crime partnership statistics need their offence members and one period",
		);
	const release = areas.release("communitySafetyPartnership", 2023);
	const added = members.map((member) => ({
		measure: measure.slug,
		release,
		members: { offence: member.code ?? memberCode(member.key) },
	}));
	const period = base.periods[0]!.label;
	const observations = function* (): Generator<StatisticsObservation> {
		let records = 0;
		for (const { code, values } of partnershipRecords(path)) {
			records++;
			for (const [index, member] of members.entries()) {
				const value = values[member.key];
				if (value === null || value === undefined) continue;
				if (typeof value !== "number" || !Number.isFinite(value))
					throw new Error(
						`${path}: ${code}.${member.key} is not a finite number`,
					);
				yield {
					series: base.series.length + index,
					code,
					period,
					value,
				};
			}
		}
		if (!records) throw new Error(`${path}: no partnership records`);
	};
	return {
		...base,
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
			if (Number(actual?.n) !== expected)
				throw new Error(
					`Crime partnerships have ${Number(actual?.n)} rows for ${expected} observations`,
				);
		},
	};
}
