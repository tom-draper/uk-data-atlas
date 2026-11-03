import { expect, it } from "vitest";
import { correctedSource } from "../src/geographies/correctBoundarySource";

it("decodes an uncorrected boundary source and rejects invalid input", async () => {
	const correction = {
		label: "ward/test",
		codeKey: "code",
		offsets: [],
		substitutions: [],
		reversedOffsets: [],
	};
	const source = {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: { code: "E1" },
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[-1, 52],
							[0, 52],
							[0, 53],
							[-1, 52],
						],
					],
				},
			},
		],
	};
	const result = await correctedSource(JSON.stringify(source), correction);
	expect(result.features[0]?.properties).toEqual({ code: "E1" });
	expect(result.features[0]?.geometry.coordinates).toEqual([
		[
			[-1, 52],
			[0, 52],
			[0, 53],
			[-1, 52],
		],
	]);
	await expect(correctedSource("{}", correction)).rejects.toThrow(
		"Boundary data is not valid GeoJSON or TopoJSON",
	);
});
