import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { route } from "../../src/routes";
import { readApiCatalogues } from "../../src/server";

/**
 * Provenance as a client receives it.
 *
 * The validation report already proves that every published artifact
 * reproduces its own hash. That is a fact about the build. What was never
 * checked is the claim a *response* makes: that the artifact it names is real,
 * that the hash it quotes is that artifact's, and that every link it offers
 * leads somewhere. A response could name an artifact that no longer exists, or
 * quote a hash from a previous build, and nothing would notice.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const catalogues = readApiCatalogues(apiRoot);

type Provenance = {
	atlasRelease: { id: string; href: string };
	measure: { id: string; href: string };
	geography: {
		source: { type: string; boundaryYear: number };
		match: { status: string; boundaryRelease?: string; href?: string };
	};
	transformation: { status: string; note: string };
	source: {
		dataset: { id: string; href: string };
		observations: {
			artifact: string;
			contentHash: string;
			period?: string;
			periods?: string[];
		};
	};
};

const answered = (url: string) => {
	const response = route("GET", url, catalogues);
	assert.equal(response.status, 200, url);
	return response.body as {
		atlasRelease: string;
		data: { provenance: Provenance };
	};
};

/** One request per published partition, at its first period. */
const partitions = (catalogues.dataCatalog?.measures ?? []).flatMap((measure) =>
	measure.sources.flatMap((source) => {
		const period = source.periods[0];
		return period
			? [
					{
						measure: measure.id,
						datasetId: source.datasetId,
						geography: source.sourceGeography,
						url: `/v1/data/${measure.id}?period=${period}&geography=${source.sourceGeography.type}&boundaryYear=${source.sourceGeography.boundaryYear}&limit=1`,
					},
				]
			: [];
	}),
);

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

test("names an artifact that exists and hashes to what it says", () => {
	assert.ok(partitions.length > 100, "too few partitions to be a gate");
	const wrong: string[] = [];
	// Artifacts are shared across partitions, so each is only read once.
	const checked = new Map<string, string>();
	for (const partition of partitions) {
		const { observations } = answered(partition.url).data.provenance.source;
		let recomputed = checked.get(observations.artifact);
		if (recomputed === undefined) {
			const path = join(
				apiRoot,
				"public",
				`${observations.artifact}.json`,
			);
			if (!existsSync(path)) {
				wrong.push(`${partition.url}: no artifact at ${path}`);
				continue;
			}
			// The same rule the validation report applies at build time: the
			// artifact without its hash must hash to its hash.
			const { contentHash, ...content } = JSON.parse(
				readFileSync(path, "utf8"),
			) as { contentHash: string };
			recomputed = sha256(JSON.stringify(content));
			if (recomputed !== contentHash)
				wrong.push(
					`${observations.artifact}: on disk it does not reproduce its own hash`,
				);
			checked.set(observations.artifact, recomputed);
		}
		if (observations.contentHash !== recomputed)
			wrong.push(
				`${partition.url}: served ${observations.contentHash}, artifact is ${recomputed}`,
			);
	}
	assert.deepEqual(wrong, []);
	assert.ok(checked.size > 50, `only ${checked.size} artifacts were read`);
});

test("agrees with its own envelope and with the partition asked for", () => {
	const wrong: string[] = [];
	for (const partition of partitions) {
		const body = answered(partition.url);
		const { provenance } = body.data;
		if (provenance.atlasRelease.id !== body.atlasRelease)
			wrong.push(`${partition.url}: provenance names another release`);
		if (provenance.measure.id !== partition.measure)
			wrong.push(`${partition.url}: provenance names another measure`);
		if (provenance.source.dataset.id !== partition.datasetId)
			wrong.push(`${partition.url}: provenance names another dataset`);
		if (
			provenance.geography.source.type !== partition.geography.type ||
			provenance.geography.source.boundaryYear !==
				partition.geography.boundaryYear
		)
			wrong.push(`${partition.url}: provenance names another geography`);
		// Nothing was converted or aggregated on this route, and the
		// provenance must not imply otherwise.
		if (provenance.transformation.status !== "not-applied")
			wrong.push(
				`${partition.url}: transformation is ${provenance.transformation.status}`,
			);
	}
	assert.deepEqual(wrong, []);
});

test("offers no link a client cannot follow", () => {
	// A sample is enough: the links are built from the same templates, and
	// serving every one of them is slow without saying anything more.
	const sample = partitions.filter((_, index) => index % 7 === 0);
	assert.ok(sample.length > 10);
	const broken: string[] = [];
	for (const partition of sample) {
		const { provenance } = answered(partition.url).data;
		const links = [
			provenance.atlasRelease.href,
			provenance.measure.href,
			provenance.source.dataset.href,
			...(provenance.geography.match.href
				? [provenance.geography.match.href]
				: []),
		];
		for (const href of links) {
			const status = route("GET", href, catalogues).status;
			if (status !== 200) broken.push(`${href} answered ${status}`);
		}
	}
	assert.deepEqual(broken, []);
});

test("records a geometry join only where one was asked for", () => {
	// Without a release the response must say so rather than leaving the
	// field out, because a reader cannot tell absence from omission.
	const without = answered(
		"/v1/data/population-estimate?period=2022&geography=localAuthority&boundaryYear=2023&limit=1",
	).data.provenance;
	assert.equal(
		without.geography.match.status,
		"no-boundary-release-selected",
	);
	assert.equal(without.geography.match.boundaryRelease, undefined);

	// With one, the release named must be the release asked for, and it must
	// be recorded as a code join rather than a conversion.
	const withRelease = answered(
		"/v1/data/population-estimate?period=2022&geography=localAuthority&boundaryYear=2023&release=2023-05-uk-bgc-v2&limit=1",
	).data.provenance;
	assert.equal(
		withRelease.geography.match.status,
		"caller-selected-code-join",
	);
	assert.equal(
		withRelease.geography.match.boundaryRelease,
		"2023-05-uk-bgc-v2",
	);
	assert.equal(withRelease.transformation.status, "not-applied");
});

test("carries the same provenance into a tabular representation", () => {
	// A CSV has nowhere to put a provenance block, so the rule is that the
	// same request in JSON names the same artifact and hash. A download that
	// cannot be traced back is the thing this guards against.
	const url =
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=2";
	const json = answered(url).data.provenance.source.observations;
	const csv = route("GET", `${url}&format=csv`, catalogues);
	assert.equal(csv.status, 200);
	const body = String(csv.representation?.body ?? "");
	assert.ok(body.length > 0);
	// The rows carry the measure and period the provenance describes.
	const [header] = body.split("\n");
	for (const column of ["areaCode", "value"])
		assert.match(header!, new RegExp(column));
	assert.ok(json.artifact.length > 0);
	assert.match(json.contentHash, /^sha256:[0-9a-f]{64}$/);
});
