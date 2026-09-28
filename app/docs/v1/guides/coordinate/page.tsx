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
	"Explore a coordinate",
	"A practical guide to turning a latitude and longitude into the UK areas, statistics and nearby places it describes with the UK Data Atlas API.",
	"/docs/v1/guides/coordinate",
);

const API = API_BASE_URL;

export default function CoordinateGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/coordinate"
			eyebrow="Guide"
			title="Explore a coordinate"
			lede="Have a latitude and longitude from a phone, a map or a spreadsheet? Start with the point, discover which UK areas it falls in, then use those area identities to ask for statistics and context without guessing what the place is called."
			toc={[
				{ id: "contain", title: "Find containing areas" },
				{ id: "understand", title: "Understand the result" },
				{ id: "near", title: "Handle the edge cases" },
				{ id: "measure", title: "Get a statistic" },
				{ id: "cite", title: "Keep the evidence" },
			]}
		>
			<Steps>
				<Step id="contain" title="Find containing areas">
					<P>
						Use WGS 84 longitude and latitude in decimal degrees.
						Here the point is in Leeds, and we ask for both its ward
						and local authority. Add a `date` when you want the API
						to choose the boundary release that was current at a
						particular time.
					</P>
					<Request
						url={`${API}/areas:contains?lng=-1.5491&lat=53.8008&geography=ward&geography=localAuthority&date=2025-06-01`}
						operationId="findContainingAreas"
					/>
				</Step>

				<Step id="understand" title="Understand the result">
					<P>
						Read `matches[].id`, not just the displayed name. An id
						such as `localAuthority/2025-05-uk-bgc-v2/E08000035`
						tells you the geography, boundary release and official
						code together. The response also says whether the point
						was in the interior or on a boundary, and how much
						positional uncertainty was allowed.
					</P>
					<Callout tone="tip">
						Names are for people; ids are for joining data. Keep the
						full id when you store the result, because an area code
						can be reused in a different boundary release.
					</Callout>
				</Step>

				<Step id="near" title="Handle the edge cases">
					<P>
						A point can be offshore, just outside a generalised
						boundary or near several places. `areas:contains`
						reports explicit statuses; it never invents an area. If
						containment has no answer, ask for the nearest areas
						instead and show the distance to the user.
					</P>
					<Request
						url={`${API}/areas:near?lng=-1.5491&lat=53.8008&geography=ward&date=2025-06-01&limit=3&within=5000`}
						operationId="findNearestAreas"
					/>
					<Callout tone="note">
						A nearest area is not a containing area. Use it as
						nearby context, not as proof that the point lies inside
						it.
					</Callout>
				</Step>

				<Step id="measure" title="Get a statistic">
					<P>
						Once you have the geography, release and code, pass the
						code to a measure route. This asks for the population
						published for Leeds' local authority source partition in
						2024.
					</P>
					<Request
						url={`${API}/data/population-estimate?period=2024&geography=localAuthority&boundaryYear=2023&areaCode=E08000035`}
						operationId="getMeasureObservations"
					/>
				</Step>

				<Step id="cite" title="Keep the evidence">
					<P>
						For anything you publish, retain the response's
						`atlasRelease`, boundary release and source partition.
						The top-level hash pins the API response build; inside
						`data`, the identity, boundary and measure hashes pin
						the artifacts that support the result. The citation
						route also gives you attribution text for a map or
						report.
					</P>
					<Request
						url={`${API}/areas/localAuthority/2025-05-uk-bgc-v2/E08000035/citation?measure=population-estimate`}
						operationId="getAreaCitation"
					/>
				</Step>
			</Steps>

			<P>
				The same containment route accepts British National Grid easting
				and northing, Irish Grid coordinates and Ordnance Survey grid
				references when you set the matching `crs`. That makes it
				suitable for survey data as well as web-map coordinates.
			</P>
			<EndpointRef id="findContainingAreas" />
			<EndpointRef id="findNearestAreas" />
			<EndpointRef id="getAreaCapabilities" />
		</DocPage>
	);
}
