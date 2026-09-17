import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	P,
	Step,
	Steps,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Draw a map",
	"A step-by-step guide to mapping UK statistics with the UK Data Atlas API: choose boundaries, check the data fits, fetch values and shapes, and attribute your map.",
	"/docs/guides/map",
);

const API = API_BASE_URL;

export default function MapGuidePage() {
	return (
		<DocPage
			href="/docs/guides/map"
			eyebrow="Guide"
			title="Draw a map"
			lede="Maps go wrong quietly: data from one year drawn on boundaries from another leaves areas blank or in the wrong place. This guide maps Birmingham's population in a way that can't go wrong, and shows you why each step is there."
			toc={[
				{ id: "place", title: "Find the place" },
				{ id: "boundaries", title: "Choose boundaries" },
				{ id: "fit", title: "Check the data fits" },
				{ id: "values", title: "Fetch the values" },
				{ id: "shape", title: "Fetch the shape" },
				{ id: "attribute", title: "Credit your sources" },
				{ id: "tiles", title: "Mapping many areas" },
			]}
		>
			<Steps>
				<Step id="place" title="Find the place">
					<P>
						Start from the name and pick the local authority from
						the results. Its `code` is `E08000025`.
					</P>
					<Request url={`${API}/places?q=Birmingham`} />
				</Step>

				<Step id="boundaries" title="Choose boundaries">
					<P>
						Decide which boundaries to draw by date. This returns an
						exact release id in `data.selected.id`, never a moving
						"latest", so your map won't change underneath you.
					</P>
					<Request
						url={`${API}/boundary-releases:resolve?geography=localAuthority&date=2023-06-30`}
					/>
				</Step>

				<Step id="fit" title="Check the data fits">
					<P>
						Ask which boundary releases the population data can be
						drawn on. Look for your release with a status of
						`exact-code-set` or `code-set-compatible`, which means
						every area in the data exists in those boundaries.
					</P>
					<Request
						url={`${API}/measures/population-estimate/compatibility`}
					/>
				</Step>

				<Step id="values" title="Fetch the values">
					<P>
						Now request the values with your chosen `release`. The
						API joins them to the boundaries by area code, and
						`provenance.transformation.status` confirms nothing was
						converted.
					</P>
					<Request
						url={`${API}/data/population-estimate?period=2024&geography=localAuthority&boundaryYear=2023&release={release}&areaCode=E08000025`}
					/>
					<Callout tone="tip">
						{
							"Replace `{release}` with the id from step 2. If the codes didn't fit, this request would be refused with `incompatible_geometry` rather than drawing a map with holes."
						}
					</Callout>
				</Step>

				<Step id="shape" title="Fetch the shape">
					<P>
						Get Birmingham's boundary from the same release.
						`tier=medium` keeps the file small enough for the web.
					</P>
					<Request
						url={`${API}/areas/localAuthority/{release}/E08000025/geometry?tier=medium`}
					/>
				</Step>

				<Step id="attribute" title="Credit your sources">
					<P>
						Published maps need attribution. This returns
						ready-to-use text covering both the data and the
						boundaries:
					</P>
					<Request
						url={`${API}/attribution?measure=population-estimate&boundaryRelease=localAuthority/{release}`}
					/>
				</Step>
			</Steps>

			<P>
				Finally, check every response carries the same `atlasRelease`.
				If they do, your whole map came from one consistent set of data.
			</P>

			<H2 id="tiles">Mapping many areas</H2>
			<P>
				For a map of the whole country, fetching one shape at a time is
				too slow. Use vector tiles instead: configure your map library
				with the TileJSON, then colour the areas with a small table of
				values that shares the tiles' numbering.
			</P>
			<EndpointRef id="getMapResourceTileJson" />
			<EndpointRef id="getMapResourceJoin" />
			<EndpointRef id="getMapResourceArchive" />
		</DocPage>
	);
}
