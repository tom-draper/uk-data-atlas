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
	"Compare an area",
	"A guide to comparing a UK area with others using the UK Data Atlas API: rank every area, put two side by side, find its neighbours, and measure how areas of different kinds overlap.",
	"/docs/v1/guides/compare",
);

const API = API_BASE_URL;

const PARTITION = "period=2024&geography=localAuthority&codeYear=2023";

export default function CompareGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/compare"
			eyebrow="Guide"
			title="Compare an area"
			lede="A number means more next to others: is Birmingham's population large for a council, how does it compare with Leeds, and what about the councils around it? This guide answers each question within one set of published figures, so every comparison is like for like."
			toc={[
				{ id: "rank", title: "Rank every area" },
				{ id: "pair", title: "Put two side by side" },
				{ id: "neighbours", title: "Find the neighbours" },
				{ id: "overlap", title: "Compare across geographies" },
			]}
		>
			<Steps>
				<Step id="rank" title="Rank every area">
					<P>
						Rank the local authorities by population for one period,
						largest first. Tied values share a rank, so you'll see
						1, 1, 3.
					</P>
					<Request
						url={`${API}/data/population/rankings?${PARTITION}&limit=10`}
					/>
					<P>
						To see where one area ranks by how much it changed
						rather than by its value, use [Rank areas by
						change](/docs/v1/reference/trend/source-exact-measure-change)
						with `place`, as in [Chart a
						trend](/docs/v1/guides/trend#rank).
					</P>
				</Step>
				<Step id="pair" title="Put two side by side">
					<P>
						Give a baseline and a comparison area to get both values
						and the difference. Unambiguous place names work as well
						as codes.
					</P>
					<Request
						url={`${API}/data/population/compare?${PARTITION}&baselinePlace=E08000025&comparisonPlace=E08000035`}
					/>
					<Callout tone="note">
						Both areas must be in the same published set of figures.
						For a rate or a share, the difference is reported on its
						own scale, not as a percentage change that would
						mislead.
					</Callout>
				</Step>
				<Step id="neighbours" title="Find the neighbours">
					<P>
						The councils that share a border with Birmingham,
						longest shared border first. Borders are matched exactly
						from the boundaries, with no distance threshold, and
						areas that only meet at a corner are left out unless you
						add `touches=any`.
					</P>
					<Request
						url={`${API}/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/neighbours`}
						operationId="getAreaNeighbours"
					/>
					<P>
						Then fetch each neighbour's value from the same
						partition, or rank them all and pick out their codes.
					</P>
				</Step>
				<Step id="overlap" title="Compare across geographies">
					<P>
						Constituencies and councils don't nest, so comparing
						them starts with how much they overlap. This measures a
						constituency against a council without downloading
						either shape, and returns the shared area, each side's
						share of it and a relation such as `within` or
						`overlaps`.
					</P>
					<Request
						url={`${API}/areas/constituency/2024-07-uk-bgc/E14001063/overlap?place=localAuthority/2024-05-uk-bgc/E07000089`}
						operationId="getAreaOverlap"
					/>
					<Callout tone="note">
						This measures the published generalised boundaries and
						isn't an official statement of how the areas relate. Any
						published crosswalk between them is listed in
						`publishedRelationships`.
					</Callout>
				</Step>
			</Steps>

			<H2 id="next">Going further</H2>
			<P>
				To move a measure onto another set of areas, such as ward counts
				up to councils, see
				[Crosswalks](/docs/v1/concepts/crosswalks#analysis).
			</P>
			<EndpointRef id="getSourceExactMeasureRankings" />
			<EndpointRef id="compareSourceExactMeasureAreas" />
			<EndpointRef id="getAreaNeighbours" />
			<EndpointRef id="getAreaOverlap" />
		</DocPage>
	);
}
