import { type AtlasClient, createClient, type Step } from "./client";

/**
 * Correct map: render release-pinned boundaries and values without a
 * code/geometry mismatch, and cite them.
 *
 * The point of the path is that nothing is guessed. The place is resolved
 * rather than assumed, the boundary release is chosen explicitly rather than
 * left to a mutable `latest`, and the values are joined to that release only
 * because the API says every source code is in it.
 */
export const run = async (client: AtlasClient): Promise<Step[]> => {
	const steps: Step[] = [];

	// 1. A name is not an area. Ask what it could mean and choose deliberately.
	const places = await client.get<{
		candidates: Array<{
			place: string;
			name: string;
			geography: string;
			code: string;
			boundaryReleases: string[];
		}>;
	}>("/v1/places?q=Birmingham");
	// 2. Pin the boundaries to a dated release rather than to "latest".
	const resolved = await client.get<{ selected: { id: string } }>(
		"/v1/boundary-releases:resolve?geography=localAuthority&date=2023-06-30",
	);
	const release = resolved.data.selected.id;
	steps.push({
		title: "Choose a boundary release",
		detail: `Mid-2023 resolves to ${release}, an exact release id.`,
	});
	const authority = places.data.candidates.find(
		(candidate) =>
			candidate.geography === "localAuthority" &&
			candidate.boundaryReleases.includes(release),
	);
	if (!authority)
		throw new Error(`no local authority named Birmingham is in ${release}`);
	steps.push({
		title: "Resolve the place",
		detail: `"Birmingham" matched ${places.data.candidates.length} places; took ${authority.place}, which ${release} carries.`,
	});

	// 3. Ask the API whether the values can be drawn on it, rather than
	//    assuming the codes line up.
	const compatibility = await client.get<{
		sources: Array<{
			sourceGeography: { type: string; boundaryYear: number };
			candidates: Array<{ boundaryRelease: string; status: string }>;
		}>;
	}>("/v1/measures/population-estimate/compatibility");
	const source = compatibility.data.sources.find((candidate) =>
		candidate.candidates.some(
			(entry) =>
				entry.boundaryRelease === release &&
				(entry.status === "exact-code-set" ||
					entry.status === "code-set-compatible"),
		),
	);
	if (!source)
		throw new Error(
			`no population partition is compatible with ${release}`,
		);
	const partition = `geography=${source.sourceGeography.type}&boundaryYear=${source.sourceGeography.boundaryYear}`;
	steps.push({
		title: "Check the codes fit the boundaries",
		detail: `${source.sourceGeography.type} ${source.sourceGeography.boundaryYear} values are compatible with ${release}.`,
	});

	// 4. Fetch the values joined to that release. The join is by code, and the
	//    response says so: it is not a conversion.
	const values = await client.get<{
		records: Array<{ areaCode: string; value: number }>;
		provenance: {
			geography: { match: { status: string; note: string } };
			transformation: { status: string };
		};
	}>(
		`/v1/data/population-estimate?period=2024&${partition}&release=${release}&areaCode=${authority.code}`,
	);
	const record = values.data.records[0];
	if (values.data.provenance.transformation.status !== "not-applied")
		throw new Error("a map join must not transform values");
	steps.push({
		title: "Fetch the values",
		detail: `${authority.name} is ${record?.value.toLocaleString("en-GB")} people, joined as ${values.data.provenance.geography.match.status}.`,
	});

	// 5. The geometry for the same release, generalised for the web.
	const feature = await client.get<{
		id: string;
		properties: { generalisation: { tier: string; vertices: number } };
	}>(
		`/v1/areas/localAuthority/${release}/${authority.code}/geometry?tier=medium`,
	);
	steps.push({
		title: "Fetch the geometry",
		detail: `${feature.data.id} at the medium tier is ${feature.data.properties.generalisation.vertices} vertices.`,
	});

	// 6. Anything published from this needs its attribution.
	const attribution = await client.get<{ text: string }>(
		`/v1/attribution?measure=population-estimate&boundaryRelease=localAuthority/${release}`,
	);
	steps.push({
		title: "Attribute the map",
		detail: attribution.data.text
			.replaceAll("\n", " ")
			.replace(/\s+/g, " "),
	});

	// Every response came from one immutable Atlas release, so the map can be
	// reproduced exactly.
	if (attribution.atlasRelease !== values.atlasRelease)
		throw new Error("the map was drawn from two different Atlas releases");
	steps.push({
		title: "Pin the result",
		detail: `All of it came from Atlas release ${values.atlasRelease}.`,
	});
	return steps;
};

if (process.argv[1]?.endsWith("correct-map.ts")) {
	const client = createClient(
		process.env.BASE_URL ?? "http://127.0.0.1:3001",
	);
	for (const step of await run(client))
		console.log(`${step.title}: ${step.detail}`);
}
