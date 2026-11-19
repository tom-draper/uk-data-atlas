import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";

import { route } from "../../src/routes";
import { readApiCatalogues } from "../../src/server";

/**
 * The golden case for a series on one boundary release, against the built
 * atlas: a ward's local election votes stitched from three ward releases
 * onto the 2026 wards, ward population rebuilt on the 2026 wards that adds
 * up to the independently published local authority totals, and a native
 * series served unchanged.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = resolve(apiRoot, "../..");
const databasePath = atlasDatabasePath(repositoryRoot);
const catalogues = readApiCatalogues(repositoryRoot);

type Value = {
	period: string;
	value: number;
	method: "native" | "exact" | "weighted";
	source?: { release: string; crosswalks: string[] };
	flags?: string[];
};
type Body = {
	data: {
		summary: { periods: number; native: number; convertedShare: number };
		series: Value[];
		gaps: { period: string }[];
	};
};
const get = (url: string) => {
	const response = route("GET", url, catalogues);
	assert.equal(
		response.status,
		200,
		JSON.stringify(response.body).slice(0, 400),
	);
	return (response.body as Body).data;
};

/** Per local authority, 1% for its wards' sum, and 0.2% over all of them. */
const LA_TOLERANCE = 0.01;
const TOTAL_TOLERANCE = 0.002;

test("stitches a ward's votes from three boundary releases onto the 2026 wards", () => {
	// Dearne South, Barnsley: its 2022, 2023 and 2024 elections were held on
	// the 2022-12, 2023-12 and 2024-12 ward releases.
	const data = get(
		"/v1/data/effective-votes/series?place=ward/E05016574&on=ward/2026-05-uk-bgc",
	);
	const releases = new Set(
		data.series.flatMap((value) =>
			value.source ? [value.source.release] : [],
		),
	);
	for (const release of [
		"ward:2022-12-uk-bgc",
		"ward:2023-12-uk-bgc",
		"ward:2024-12-uk-bgc",
	])
		assert.ok(releases.has(release), `no value converted from ${release}`);
	for (const value of data.series) {
		assert.ok(value.value > 0);
		assert.equal(value.method, "exact");
		// The ward was made since 2024, so each value is built from the areas
		// before it, and says so.
		assert.ok(value.flags?.includes("area-not-on-source-release"));
	}
	assert.equal(data.summary.convertedShare, 1);
});

test("an exact conversion keeps the source total", () => {
	// The 2025 wards regroup whole onto the 2026 ones, so the converted
	// votes add up to the published ones exactly.
	const database = new DatabaseSync(databasePath, { readOnly: true });
	try {
		const totals = database
			.prepare(
				`SELECT s.method = 'converted' AS converted, sum(o.value) AS total
				 FROM series s
				 JOIN dataset d ON d.id = s.dataset_id
				 JOIN measure m ON m.id = s.measure_id
				 JOIN area_release r ON r.id = s.release_id
				 JOIN observation o ON o.series_id = s.id
				 JOIN period p ON p.id = o.period_id
				 WHERE d.slug = 'local-election' AND m.slug = 'party-votes'
				   AND p.label = '2025-05-01' AND r.geography = 'ward'
				   AND r.release IN ('2025-05-uk-bgc-v2', '2026-05-uk-bgc')
				 GROUP BY 1`,
			)
			.all() as { converted: number; total: number }[];
		assert.equal(totals.length, 2);
		assert.equal(totals[0]!.total, totals[1]!.total);
	} finally {
		database.close();
	}
});

test("ward population rebuilt on the 2026 wards adds up to the local authority totals", () => {
	// Each 2026 local authority whose wards all hold a 2022 value, summed
	// from the converted ward series, against the 2022 mid-year estimate
	// converted onto the 2026 authorities from a different source.
	const database = new DatabaseSync(databasePath, { readOnly: true });
	let rows: { code: string; wards: number; sum: number; published: number }[];
	try {
		rows = database
			.prepare(
				`WITH wr AS (SELECT id FROM area_release WHERE geography = 'ward' AND release = '2026-05-uk-bgc'),
				lr AS (SELECT id FROM area_release WHERE geography = 'localAuthority' AND release = '2026-05-uk-bgc'),
				p AS (SELECT id FROM period WHERE label = '2022'),
				everyone AS (
					SELECT s.id, d.slug FROM series s
					JOIN dataset d ON d.id = s.dataset_id
					JOIN series_member sm ON sm.series_id = s.id
					JOIN dimension dd ON dd.id = sm.dimension_id
					JOIN dimension_member dm ON dm.id = sm.member_id
					WHERE s.method = 'converted' AND dd.slug = 'sex' AND dm.code = 'all'),
				wardpop AS (SELECT id FROM everyone WHERE slug = 'population'
					AND id IN (SELECT id FROM series WHERE release_id = (SELECT id FROM wr))),
				lapop AS (SELECT id FROM everyone WHERE slug = 'population-uk'
					AND id IN (SELECT id FROM series WHERE release_id = (SELECT id FROM lr))),
				h AS (SELECT DISTINCT h.child_version_id ward, h.parent_version_id la
					FROM area_hierarchy h
					JOIN area_version c ON c.id = h.child_version_id
					JOIN area_version pv ON pv.id = h.parent_version_id
					WHERE c.release_id = (SELECT id FROM wr) AND pv.release_id = (SELECT id FROM lr)
					  AND h.accuracy = 'exact'),
				wv AS (SELECT area_version_id ward, sum(value) v FROM observation
					WHERE series_id IN wardpop AND period_id = (SELECT id FROM p) GROUP BY 1),
				per AS (SELECT h.la, count(*) wards, sum(wv.v) wsum, count(*) - count(wv.v) gapped
					FROM h LEFT JOIN wv ON wv.ward = h.ward GROUP BY h.la),
				lv AS (SELECT area_version_id la, sum(value) v FROM observation
					WHERE series_id IN lapop AND period_id = (SELECT id FROM p) GROUP BY 1)
				SELECT a.code, per.wards, per.wsum AS sum, lv.v AS published
				FROM per JOIN lv ON lv.la = per.la
				JOIN area_version av ON av.id = per.la JOIN area a ON a.id = av.area_id
				WHERE per.gapped = 0`,
			)
			.all() as typeof rows;
	} finally {
		database.close();
	}
	// Most authorities have every ward: those whose boundaries changed since
	// 2023 are gaps, never estimates.
	assert.ok(rows.length >= 200, `only ${rows.length} complete authorities`);
	const off = rows
		.map((row) => ({
			...row,
			error: Math.abs(row.sum - row.published) / row.published,
		}))
		.filter((row) => row.error > LA_TOLERANCE);
	assert.deepEqual(off, []);
	const sum = rows.reduce((total, row) => total + row.sum, 0);
	const published = rows.reduce((total, row) => total + row.published, 0);
	assert.ok(Math.abs(sum - published) / published <= TOTAL_TOLERANCE);

	// The route serves those same values: one authority's wards, each read
	// on the 2026 release, add up to the sum above.
	const hartlepool = rows.find((row) => row.code === "E06000001");
	assert.ok(hartlepool);
	const wards = new DatabaseSync(databasePath, { readOnly: true });
	let codes: string[];
	try {
		codes = (
			wards
				.prepare(
					`SELECT DISTINCT a.code FROM area_hierarchy h
					 JOIN area_version c ON c.id = h.child_version_id
					 JOIN area_release cr ON cr.id = c.release_id
					 JOIN area_version pv ON pv.id = h.parent_version_id
					 JOIN area pa ON pa.id = pv.area_id
					 JOIN area_release pr ON pr.id = pv.release_id
					 JOIN area a ON a.id = c.area_id
					 WHERE cr.geography = 'ward' AND cr.release = '2026-05-uk-bgc'
					   AND pr.geography = 'localAuthority' AND pr.release = '2026-05-uk-bgc'
					   AND pa.code = 'E06000001' AND h.accuracy = 'exact'`,
				)
				.all() as { code: string }[]
		).map((row) => row.code);
	} finally {
		wards.close();
	}
	assert.equal(codes.length, hartlepool.wards);
	let served = 0;
	for (const code of codes) {
		const value = get(
			`/v1/data/population/series?place=ward/${code}&on=ward/2026-05-uk-bgc&datasetId=population`,
		).series.find((entry) => entry.period === "2022");
		assert.ok(value, `${code} has no 2022 value`);
		served += value.value;
	}
	assert.equal(served, hartlepool.sum);
});

test("periods already on the target release are served unchanged", () => {
	const place = "place=E06000001&geography=localAuthority&codeYear=2026";
	const response = route(
		"GET",
		`/v1/data/band-d-council-tax/series?${place}`,
		catalogues,
	);
	assert.equal(response.status, 200);
	const published = (
		response.body as {
			data: { series: { period: string; value: number }[] };
		}
	).data.series;
	assert.ok(published.length > 0);
	const rebuilt = get(
		"/v1/data/band-d-council-tax/series?place=localAuthority/E06000001&on=localAuthority/2026-05-uk-bgc",
	);
	const native = new Map(
		rebuilt.series
			.filter((value) => value.method === "native")
			.map((value) => [value.period, value.value]),
	);
	for (const { period, value } of published)
		assert.equal(native.get(period), value, `period ${period}`);
});
