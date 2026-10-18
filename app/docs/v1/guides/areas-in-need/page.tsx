import { RequestSamples } from "@/components/docs/CodePanel";
import {
	Callout,
	DocPage,
	EndpointRef,
	P,
	Step,
	Steps,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Find the areas most in need",
	"A step-by-step guide to finding the most deprived neighbourhoods in a council area with the UK Data Atlas API, counting the people who live in them and mapping them.",
	"/docs/v1/guides/areas-in-need",
);

const API = API_BASE_URL;
const LEEDS = "localAuthority/2023-05-uk-bgc-v2/E08000035";

const ANALYSIS = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `const API = "${API}";
const get = (path) => fetch(API + path).then((r) => r.json());

// Leeds's neighbourhoods
const { data } = await get("/areas/${LEEDS}/children?childGeography=lsoa");
const leeds = new Set(data.relationships.map((r) => r.counterpart.code));

// Every neighbourhood's decile, in one file
const imd = await get("/exports/imd-decile-observations");
const deciles = new Map(
  imd.periods[0].records
    .filter((r) => leeds.has(r.areaCode))
    .map((r) => [r.areaCode, r.value]),
);

// How many neighbourhoods fall in each decile
const counts = {};
for (const decile of deciles.values()) counts[decile] = (counts[decile] ?? 0) + 1;

const mostDeprived = [...deciles].filter(([, d]) => d === 1).map(([code]) => code);`,
	},
	{
		language: "python" as const,
		label: "Python",
		code: `from collections import Counter
import requests

API = "${API}"

# Leeds's neighbourhoods
area = requests.get(
    f"{API}/areas/${LEEDS}/children",
    params={"childGeography": "lsoa"},
).json()["data"]
leeds = {r["counterpart"]["code"] for r in area["relationships"]}

# Every neighbourhood's decile, in one file
imd = requests.get(f"{API}/exports/imd-decile-observations").json()
deciles = {
    r["areaCode"]: r["value"]
    for r in imd["periods"][0]["records"]
    if r["areaCode"] in leeds
}

# How many neighbourhoods fall in each decile
counts = Counter(deciles.values())

most_deprived = [code for code, decile in deciles.items() if decile == 1]`,
	},
];

const PEOPLE = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `const table = await get("/exports/usual-residents-total-lsoa-2021");
const column = table.measures.indexOf("usual-residents-total") + 1;
const residents = new Map(table.records.map((row) => [row[0], row[column]]));

const people = mostDeprived.reduce((sum, code) => sum + residents.get(code), 0);`,
	},
	{
		language: "python" as const,
		label: "Python",
		code: `table = requests.get(f"{API}/exports/usual-residents-total-lsoa-2021").json()
column = table["measures"].index("usual-residents-total") + 1
residents = {row[0]: row[column] for row in table["records"]}

people = sum(residents[code] for code in most_deprived)`,
	},
];

export default function AreasInNeedGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/areas-in-need"
			eyebrow="Guide"
			title="Find the areas most in need"
			lede="Deciding where to open a service, target a grant or send outreach workers? Find the most deprived neighbourhoods in a council area, count the people who live in them and put them on a map, without averaging numbers that can't be averaged."
			toc={[
				{ id: "list", title: "List the neighbourhoods" },
				{ id: "deciles", title: "Get every decile at once" },
				{ id: "summarise", title: "Summarise without averaging" },
				{ id: "people", title: "Count the people" },
				{ id: "map", title: "Map them" },
				{ id: "credit", title: "Credit the sources" },
			]}
		>
			<Steps>
				<Step id="list" title="List the neighbourhoods">
					<P>
						England's Index of Multiple Deprivation ranks small
						neighbourhoods called LSOAs, each home to about 1,500
						people. A council is far too large to target, so start
						from its LSOAs. Leeds has 488:
					</P>
					<Request
						url={`${API}/areas/${LEEDS}/children?childGeography=lsoa`}
						operationId="getAreaChildren"
					/>
					<P>
						Each entry in `relationships` has the LSOA's `code` and
						name. The list comes from the official LSOA-to-council
						lookup, which is published against the May 2023 council
						boundaries, hence that release.
					</P>
				</Step>

				<Step id="deciles" title="Get every decile at once">
					<P>
						Rather than asking 488 times, download the whole index
						once. It's about 2 MB and covers every LSOA in England:
					</P>
					<Request
						url={`${API}/exports/imd-decile-observations`}
						operationId="downloadBulkExport"
					/>
					<P>
						Keep the Leeds rows and count how many fall in each
						decile. Decile 1 is the most deprived tenth of LSOAs in
						England.
					</P>
					<RequestSamples samples={ANALYSIS} />
				</Step>

				<Step id="summarise" title="Summarise without averaging">
					<P>
						An average decile for Leeds would be a number with no
						meaning, because a decile is a band of ranks. Ask for
						one and the API refuses with
						`aggregation_not_supported`:
					</P>
					<Request
						url={`${API}/data/imd-decile/value?period=2025&geography=lsoa&codeYear=2021&place=E08000035`}
					/>
					<P>
						Report the share of neighbourhoods in each decile
						instead. In Leeds, 84 of 488 are in the most deprived
						tenth nationally, about one in six.
					</P>
				</Step>

				<Step id="people" title="Count the people">
					<P>
						A count of neighbourhoods hides how many people are
						affected. Census 2021 resident counts add up across
						areas, so total them over the decile 1 LSOAs. The census
						export is a table: `measures` names the columns, and
						each row is a code followed by one value per measure.
					</P>
					<RequestSamples samples={PEOPLE} />
					<P>
						For Leeds that's about 145,000 people. The census was
						taken in 2021 and the index is from 2025, so say which
						year each figure comes from.
					</P>
				</Step>

				<Step id="map" title="Map them">
					<P>
						Fetch every LSOA's shape in one request, then colour
						each feature by its decile, matching on
						`properties.code`:
					</P>
					<Request
						url={`${API}/areas/${LEEDS}/children/geometry?childGeography=lsoa&tier=medium`}
						operationId="getAreaChildrenGeometry"
					/>
					<Callout tone="warning">
						Check that `collection.withGeometry` equals
						`collection.members`. At `tier=low`, any LSOA smaller
						than about a square kilometre is left out, and in a city
						that's most of them. `medium` keeps them all.
					</Callout>
				</Step>

				<Step id="credit" title="Credit the sources">
					<P>
						The index is published by the Ministry of Housing,
						Communities and Local Government, and the census by ONS.
						Print the attribution beside your map:
					</P>
					<Request
						url={`${API}/attribution?measure=imd-decile&measure=usual-residents-total`}
						operationId="getAttribution"
					/>
				</Step>
			</Steps>

			<Callout tone="note">
				Working outside England? Wales, Scotland and Northern Ireland
				publish their own indices, as `wimd-decile`, `simd-decile` and
				`nimdm-rank`. They rank different areas in different years, so
				don't compare them with each other.
			</Callout>

			<EndpointRef id="getAreaChildren" />
			<EndpointRef id="downloadBulkExport" />
			<EndpointRef id="getAreaChildrenGeometry" />
		</DocPage>
	);
}
