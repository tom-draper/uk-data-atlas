/**
 * API-owned changes to what the Atlas serves. Source artifacts remain the
 * evidence of what publishers supplied; this register is the separate,
 * reviewable record of any correction, normalisation or derived presentation.
 */
export type CorrectionRecord = {
	id: string;
	kind: "correction" | "derived-calculation" | "normalisation";
	status: "active" | "superseded" | "withdrawn";
	title: string;
	scope: {
		/** `*` means every published measure for which the request is valid. */
		measureIds: string[];
		fields: string[];
		request: string;
		periods?: string[];
		areaCodes?: string[];
	};
	change: {
		source: string;
		served: string;
		sourceArtifactsChanged: false;
	};
	evidence: Array<{
		kind: "method" | "catalogue";
		href: string;
		note: string;
	}>;
	review: { status: "reviewed"; note: string };
};

/**
 * Ordered oldest-first. Never rewrite a prior record: supersede it with a new
 * id so a client can explain a change between two served versions.
 */
export const correctionRecords: CorrectionRecord[] = [
	{
		id: "house-price-temple-newsam-ward-code-v1",
		kind: "correction",
		status: "active",
		title: "Temple Newsam ward-code repair",
		scope: {
			measureIds: ["house-price-median"],
			fields: ["areaCode", "sourceAreaCode"],
			request:
				"GET /v1/data/house-price-median?period={period}&geography=ward&boundaryYear=2020",
			periods: ["1995", "2022"],
			areaCodes: ["E05011412", "E05013831"],
		},
		change: {
			source: "The publisher's workbook uses Temple Newsam's December 2021 ward code E05013831 within an otherwise December 2020 ward partition.",
			served: "The API serves the unchanged value under December 2020 code E05011412 and retains E05013831 as sourceAreaCode.",
			sourceArtifactsChanged: false,
		},
		evidence: [
			{
				kind: "catalogue",
				href: "/v1/areas/ward/2020-12-uk-bgc/E05011412",
				note: "Temple Newsam's December 2020 official ward identity.",
			},
			{
				kind: "catalogue",
				href: "/v1/areas/ward/2021-12-uk-bgc/E05013831",
				note: "Temple Newsam's December 2021 official ward identity; its geometry is identical to the December 2020 feature.",
			},
		],
		review: {
			status: "reviewed",
			note: "The two official boundary features have identical geometry. Garforth & Swillington was not corrected because its geometry changed.",
		},
	},
	{
		id: "canonical-unit-presentation-v1",
		kind: "normalisation",
		status: "active",
		title: "Opt-in canonical measure-unit presentation",
		scope: {
			measureIds: ["*"],
			fields: [
				"value",
				"confidenceInterval.lower",
				"confidenceInterval.upper",
			],
			request: "GET /v1/data/{measure-id}?units=canonical",
		},
		change: {
			source: "The default response preserves each publisher's value, label and interval bounds.",
			served: "On the explicit canonical request, each numeric value and any publisher-supplied interval bound is multiplied by the measure's declared scale; the response names the resulting unit and calculation.",
			sourceArtifactsChanged: false,
		},
		evidence: [
			{
				kind: "method",
				href: "/v1/measures",
				note: "Every served measure declares its display unit and API-owned canonical unit definition.",
			},
		],
		review: {
			status: "reviewed",
			note: "The transformation is opt-in, has a declared positive scale, and is refused for categorical observations.",
		},
	},
];

export const correctionsForMeasure = (measureId: string | null) =>
	measureId === null
		? correctionRecords
		: correctionRecords.filter(
				(record) =>
					record.scope.measureIds.includes("*") ||
					record.scope.measureIds.includes(measureId),
			);

/** Records applying to at least one measure in a documentation topic. */
export const correctionsForMeasures = (measureIds: Iterable<string>) => {
	const ids = new Set(measureIds);
	return correctionRecords.filter(
		(record) =>
			record.scope.measureIds.includes("*") ||
			record.scope.measureIds.some((id) => ids.has(id)),
	);
};
