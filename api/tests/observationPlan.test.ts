import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveObservations } from "../src/resolve/observationPlan";
import { readApiCatalogues } from "../src/server";

/**
 * The resolver, on its own.
 *
 * Its job is to answer one question the same way every time, and to refuse in
 * a way a caller can act on. The refusals matter more than the plans here:
 * every one of them is checked for the alternatives it carries, because a
 * refusal that only says no is what this layer exists to stop.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogues = readApiCatalogues(apiRoot);

const plan = (request: Parameters<typeof resolveObservations>[1]) => {
	const resolved = resolveObservations(catalogues, request);
	assert.equal(
		resolved.kind,
		"plan",
		`expected a plan, got: ${JSON.stringify(resolved)}`,
	);
	return resolved.kind === "plan" ? resolved.plan : undefined!;
};

const refusal = (request: Parameters<typeof resolveObservations>[1]) => {
	const resolved = resolveObservations(catalogues, request);
	assert.equal(resolved.kind, "refusal", "expected a refusal");
	return resolved.kind === "refusal" ? resolved.refusal : undefined!;
};

test("plans a named partition", () => {
	const resolved = plan({
		measureId: "population-estimate",
		periods: ["2022"],
		geography: "localAuthority",
		boundaryYear: "2023",
	});
	assert.equal(resolved.measure.id, "population-estimate");
	assert.equal(resolved.source.sourceGeography.type, "localAuthority");
	assert.deepEqual(resolved.periods, ["2022"]);
	// No release was asked for, so no join is planned.
	assert.equal(resolved.join, undefined);
});

test("plans a join only where every source code is in the release", () => {
	const resolved = plan({
		measureId: "population-estimate",
		periods: ["2022"],
		geography: "localAuthority",
		boundaryYear: "2023",
		release: "2023-05-uk-bgc-v2",
	});
	assert.equal(resolved.join?.boundaryRelease, "2023-05-uk-bgc-v2");
	assert.ok(
		["exact-code-set", "code-set-compatible"].includes(
			resolved.join!.compatibility,
		),
	);
});

test("refuses an unknown measure and an unpublished period", () => {
	const unknown = refusal({ measureId: "not-a-measure", periods: ["2022"] });
	assert.equal(unknown.status, 404);

	const period = refusal({
		measureId: "population-estimate",
		periods: ["1801"],
		geography: "localAuthority",
		boundaryYear: "2023",
	});
	assert.equal(period.status, 400);
	assert.ok(
		(period.alternatives?.periods ?? []).length > 0,
		"a refused period should say which periods exist",
	);
});

test("plans a partition itself when no period is asked for", () => {
	// A series wants the whole partition, not a moment in it. Naming the
	// geography is what narrows it; a route that needs a period asks for one
	// itself, because only the route knows whether its contract requires it.
	const whole = plan({
		measureId: "population-estimate",
		periods: [],
		geography: "localAuthority",
		boundaryYear: "2023",
	});
	assert.deepEqual(whole.periods, []);
	assert.ok(whole.source.periods.length > 1);
});

test("plans a partition covering every period a change spans", () => {
	// Change is measured inside one partition, so both ends must be in the
	// same one. A partition holding only one of them is not a match.
	const across = plan({
		measureId: "population-estimate",
		periods: ["2012", "2022"],
		geography: "localAuthority",
		boundaryYear: "2023",
	});
	for (const period of ["2012", "2022"])
		assert.ok(across.source.periods.includes(period));

	const straddling = refusal({
		measureId: "population-estimate",
		periods: ["2022", "1801"],
		geography: "localAuthority",
		boundaryYear: "2023",
	});
	assert.equal(straddling.status, 400);
	assert.match(straddling.detail, /no source on|no single source covering/);
});

test("uses a dataset to choose between partitions that otherwise tie", () => {
	// Nothing in the catalogue ties today, so this proves the discriminator
	// narrows rather than that it is currently needed.
	const named = plan({
		measureId: "population-estimate",
		periods: ["2022"],
		geography: "localAuthority",
		boundaryYear: "2023",
	});
	const byDataset = plan({
		measureId: "population-estimate",
		periods: ["2022"],
		geography: "localAuthority",
		boundaryYear: "2023",
		datasetId: named.source.datasetId,
	});
	assert.equal(byDataset.source.datasetId, named.source.datasetId);

	const wrong = refusal({
		measureId: "population-estimate",
		periods: ["2022"],
		geography: "localAuthority",
		boundaryYear: "2023",
		datasetId: "not-a-dataset",
	});
	assert.equal(wrong.status, 400);
});

test("refuses an ambiguous request with the partitions to choose from", () => {
	// Several partitions serve 2022, so choosing one would mean choosing by
	// catalogue order.
	const ambiguous = refusal({
		measureId: "population-estimate",
		periods: ["2022"],
	});
	assert.equal(ambiguous.status, 400);
	assert.match(ambiguous.detail, /name the geography and boundary year/);
	const partitions = ambiguous.alternatives?.partitions ?? [];
	assert.ok(partitions.length > 1);
	for (const partition of partitions) {
		assert.ok(partition.geography);
		assert.ok(partition.boundaryYear);
		assert.ok(partition.periods.length > 0);
	}
});

test("refuses a partition the measure does not publish", () => {
	const wrong = refusal({
		measureId: "population-estimate",
		periods: ["2022"],
		geography: "ward",
		boundaryYear: "1999",
	});
	assert.equal(wrong.status, 400);
	assert.ok((wrong.alternatives?.partitions ?? []).length > 0);
});

test("refuses a geometry it cannot carry and names ones it can", () => {
	const refused = refusal({
		measureId: "imd-rank",
		periods: ["2019"],
		release: "2023-05-uk-bgc-v2",
	});
	assert.equal(refused.status, 422);
	assert.equal(refused.code, "incompatible_geometry");
	const releases = refused.alternatives?.releases ?? [];
	assert.ok(releases.length > 0, "the refusal names no release that works");
	// And what it names really does work.
	for (const release of releases) {
		const resolved = plan({
			measureId: "imd-rank",
			periods: ["2019"],
			release,
		});
		assert.equal(resolved.join?.boundaryRelease, release);
	}
});

test("reports possibilities without acting on them", () => {
	// The resolver knows which releases would carry imd-rank, and still
	// refuses the one that was asked for rather than substituting a working
	// one. Source-exact means the caller chooses.
	const refused = refusal({
		measureId: "imd-rank",
		periods: ["2019"],
		release: "2023-05-uk-bgc-v2",
	});
	assert.ok((refused.alternatives?.releases ?? []).length > 0);
	assert.ok(
		!refused.alternatives!.releases!.includes("2023-05-uk-bgc-v2"),
		"the refused release must not be offered as an alternative to itself",
	);
});

test("refuses without a catalogue rather than pretending", () => {
	const resolved = resolveObservations(
		{},
		{ measureId: "population-estimate", periods: ["2022"] },
	);
	assert.equal(resolved.kind, "refusal");
	assert.equal(
		resolved.kind === "refusal" ? resolved.refusal.status : 0,
		503,
	);
});
