import assert from "node:assert/strict";
import { test } from "vitest";
import {
	CORE_COMPATIBILITY_KEY,
	DATASET_MODULE_IDS,
	MODULE_MANIFEST_SCHEMA_VERSION,
	buildModuleManifests,
	DATASET_THEMES,
	topicsOfTheme,
} from "@uk-data-atlas/datasets/registry";
import { route as routeRequest } from "../src/routes";
import { routeWithData, testContext } from "./routeFixtures";

const body = (url: string) => {
	const answer = routeWithData(url);
	return { status: answer.status, body: answer.body as any };
};

const populationTaxonomy = {
	theme: "population",
	topic: "population-estimates",
	module: "population-detail",
};

test("dataset and measure responses carry theme, topic and module", () => {
	const list = body("/v1/datasets");
	assert.equal(list.status, 200);
	const population = list.body.data.find((d: any) => d.id === "population");
	assert.deepEqual(
		{
			theme: population.theme,
			topic: population.topic,
			module: population.module,
		},
		populationTaxonomy,
	);

	const detail = body("/v1/datasets/population");
	assert.equal(detail.status, 200);
	assert.equal(detail.body.data.theme, "population");
	assert.equal(detail.body.data.topic, "population-estimates");
	assert.equal(detail.body.data.module, "population-detail");

	const measures = body("/v1/measures");
	const measure = measures.body.data.find((m: any) => m.id === "population");
	assert.equal(measure.theme, "population");
	assert.equal(measure.module, "population-detail");
	const measureDetail = body("/v1/measures/population");
	assert.equal(measureDetail.body.data.topic, "population-estimates");
});

test("datasets and measures filter by theme, topic and module", () => {
	for (const filter of ["theme", "topic", "module"] as const) {
		const value = populationTaxonomy[filter];
		for (const path of ["datasets", "measures"]) {
			const answer = body(`/v1/${path}?${filter}=${value}`);
			assert.equal(answer.status, 200, `${path} ${filter}`);
			assert.ok(answer.body.data.length > 0, `${path} ${filter}`);
			for (const item of answer.body.data)
				assert.equal(item[filter], value);
		}
	}
	const other = body("/v1/datasets?theme=economy");
	assert.equal(other.status, 200);
	assert.ok(
		!other.body.data.some((d: any) => d.id === "population"),
		"datasets outside the theme are excluded",
	);
	const combined = body(
		"/v1/datasets?theme=population&topic=population-estimates",
	);
	assert.equal(combined.status, 200);
	assert.ok(combined.body.data.some((d: any) => d.id === "population"));
	const mismatched = body(
		"/v1/datasets?theme=economy&topic=population-estimates",
	);
	assert.equal(mismatched.status, 200);
	assert.deepEqual(mismatched.body.data, []);
});

test("unknown theme, topic and module values are rejected", () => {
	for (const [parameter, label] of [
		["theme", "a theme"],
		["topic", "a topic"],
		["module", "a module"],
	] as const) {
		for (const path of ["datasets", "measures"]) {
			const answer = body(`/v1/${path}?${parameter}=nonsense`);
			assert.equal(answer.status, 400, `${path} ${parameter}`);
			assert.equal(answer.body.code, "unknown_filter_value");
			assert.equal(answer.body.parameter, parameter);
			assert.ok(Array.isArray(answer.body.members));
			assert.match(answer.body.detail, new RegExp(`is not ${label}`));
		}
	}
});

test("GET /v1/themes lists themes in registry order with their topics", () => {
	const answer = body("/v1/themes");
	assert.equal(answer.status, 200);
	assert.equal(answer.body.apiVersion, "v1");
	assert.deepEqual(
		answer.body.data.map((theme: any) => theme.id),
		DATASET_THEMES.map((theme) => theme.id),
	);
	for (const theme of answer.body.data) {
		assert.deepEqual(
			theme.topics.map((topic: any) => topic.id),
			topicsOfTheme(theme.id).map((topic) => topic.id),
		);
		assert.equal(theme.links.datasets, `/v1/datasets?theme=${theme.id}`);
	}
	const population = answer.body.data.find((t: any) => t.id === "population");
	assert.equal(population.datasetCount, 1);
	assert.equal(
		population.topics.find((t: any) => t.id === "population-estimates")
			.datasetCount,
		1,
	);
});

test("GET /v1/modules lists theme modules then foundation parts", () => {
	const answer = body("/v1/modules");
	assert.equal(answer.status, 200);
	const ids = answer.body.data.map((m: any) => m.id);
	assert.deepEqual(ids, [...DATASET_MODULE_IDS]);
	const population = answer.body.data.find(
		(m: any) => m.id === "population-detail",
	);
	assert.equal(population.kind, "theme");
	assert.deepEqual(population.themes, ["population"]);
	assert.equal(population.datasetCount, 1);
	assert.ok(
		population.topics.some((t: any) => t.id === "population-estimates"),
	);
	const core = answer.body.data.find((m: any) => m.id === "core");
	assert.equal(core.kind, "foundation");
	assert.equal(core.datasetCount, 0);
	assert.deepEqual(core.themes, []);
});

test("GET /v1/modules serves the manifest the data download is built from", () => {
	const answer = body("/v1/modules");
	const manifests = buildModuleManifests({ datasets: () => [] });
	assert.deepEqual(
		answer.body.data.map((m: any) => [m.id, m.kind, m.alwaysIncluded]),
		manifests.map((m) => [m.id, m.kind, m.alwaysIncluded]),
	);
	for (const module of answer.body.data) {
		const manifest = manifests.find((m) => m.id === module.id)!;
		assert.equal(module.schemaVersion, MODULE_MANIFEST_SCHEMA_VERSION);
		assert.deepEqual(module.compatibility, {
			core: CORE_COMPATIBILITY_KEY,
		});
		assert.deepEqual(
			module.datasets.map((d: any) => d.id),
			manifest.datasets.map((d) => d.id),
		);
		assert.deepEqual(module.build, {
			status: "not-built",
			bytes: null,
			files: null,
		});
	}
	const core = answer.body.data.find((m: any) => m.id === "core");
	assert.equal(core.licences, null, "foundation licences are not derived");
	const population = answer.body.data.find(
		(m: any) => m.id === "population-detail",
	);
	assert.deepEqual(
		population.licences.map((l: any) => l.id),
		["ogl-3.0"],
	);
	assert.equal(population.licenceConflict, null);
});

test("GET /v1/modules lists an add-on with what it requires and adds to", () => {
	const answer = body("/v1/modules");
	const find = (id: string) => answer.body.data.find((m: any) => m.id === id);
	assert.deepEqual(find("politics-sharealike").requires, ["politics"]);
	assert.deepEqual(find("politics").addOns, ["politics-sharealike"]);
	assert.deepEqual(find("population-detail").requires, []);
	assert.deepEqual(find("core").requires, []);
	assert.deepEqual(
		find("politics-sharealike").datasets.map((d: any) => d.partial),
		[true],
	);
});

test("a dataset an add-on adds rows to is in both modules of the module filter", () => {
	const modules = body("/v1/datasets?module=politics-sharealike");
	assert.equal(modules.status, 200);
	for (const dataset of modules.body.data)
		assert.equal(dataset.module, "politics");
});

test("themes and modules are unavailable without the data catalogue", () => {
	for (const path of ["themes", "modules"]) {
		const answer = routeRequest("GET", `/v1/${path}`, testContext());
		assert.equal(answer.status, 503, path);
	}
});
