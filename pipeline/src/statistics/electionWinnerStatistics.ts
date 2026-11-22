import {
	seriesKey,
	type StatisticsDataset,
	type StatisticsObservation,
} from "@uk-data-atlas/measures";

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

/**
 * Adds each contest's winning party, as the source reports it, to the
 * election's statistics as a category measure beside its votes.
 */
export function electionWinnerStatistics(
	base: StatisticsDataset,
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
		for (const election of base.elections?.() ?? []) {
			const period = base.periods.find((item) =>
				item.label.startsWith(`${election.label}-`),
			);
			for (const { release, code, contest } of election.contests) {
				const category = contest?.winner;
				if (category === undefined || category === null) continue;
				if (!codes.includes(category))
					throw new Error(
						`${base.slug}: invalid winning party ${category}`,
					);
				const index = releases.findIndex(
					(item) =>
						item.geography === release.geography &&
						item.id === release.id,
				);
				if (index < 0 || !period)
					throw new Error(
						`${base.slug}: no series or period for ${election.label} ${code}`,
					);
				yield {
					series: base.series.length + index,
					code,
					period: period.label,
					value: null,
					category,
				};
			}
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
				statistic: "category",
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
					"SELECT count(*) AS n FROM observation o JOIN series s ON s.method = 'published' AND s.id = o.series_id WHERE s.key IN (SELECT value FROM json_each(?))",
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
					JOIN series s ON s.method = 'published' AND s.id = o.series_id
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
