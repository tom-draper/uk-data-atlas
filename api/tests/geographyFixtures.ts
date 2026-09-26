import { createAreaLookup } from "../src/areaInventory";
import type {
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "../src/namedLocations";

export const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:wards",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		codeProperty: "WD25CD",
		nameProperty: "WD25NM",
		areas: [
			{
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:authorities",
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		codeProperty: "LAD25CD",
		nameProperty: "LAD25NM",
		areas: [
			{ code: "E08000001", name: "Greater Manchester", aliases: ["GM"] },
		],
	},
]);

const endpoints = {
	from: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
	to: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
} as const;

export const containmentCrosswalk: PropertyCrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:ward-to-authority",
	id: "ward-to-local-authority-2025",
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
	to: { geography: "localAuthority", boundaryRelease: "2025-01-uk-lad" },
	provenance: { input: "wards.geojson", inputHash: "sha256:wards" },
	validation: { sourceNameConflicts: [], endpoints },
	records: [
		{
			source: { code: "E05000001", labels: ["Example ward"] },
			targets: [{ code: "E08000001", labels: ["Greater Manchester"] }],
		},
	],
};

export const crosswalkInventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalks",
	crosswalks: [
		{
			id: containmentCrosswalk.id,
			from: containmentCrosswalk.from,
			to: containmentCrosswalk.to,
			method: containmentCrosswalk.method,
			quality: containmentCrosswalk.quality,
			weighting: containmentCrosswalk.weighting,
			recordCount: containmentCrosswalk.records.length,
			artifact: `crosswalks/${containmentCrosswalk.id}.json`,
			contentHash: containmentCrosswalk.contentHash,
		},
	],
};

export const namedLocationInventory: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: {
		artifact: "data/datasets/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "greater-manchester",
			label: "Greater Manchester",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "localAuthority",
			memberCodes: ["E08000001"],
			validity: { from: null, to: null },
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
};

export const namedLocationLookup = createNamedLocationLookup(
	namedLocationInventory,
);
