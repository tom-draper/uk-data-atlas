import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	List,
	P,
} from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Early access",
	"The UK Data Atlas API is live in early access. What may still change, what stays the same, and how to keep up.",
	"/docs/v1/early-access",
);

export default function EarlyAccessPage() {
	return (
		<DocPage
			href="/docs/v1/early-access"
			eyebrow="Get started"
			title="Early access"
			lede="The API is live and free to use, but it's in early access. We're still shaping it around what people ask of it, so parts of v1 will change before it's frozen."
			toc={[
				{ id: "may-change", title: "What may change" },
				{ id: "stays", title: "What stays the same" },
				{ id: "keeping-up", title: "Keeping up" },
			]}
		>
			<H2 id="may-change">What may change</H2>
			<P>
				Until early access ends, any part of the request and response
				shape can change, including:
			</P>
			<List
				items={[
					"**Routes.** Endpoints may be renamed, merged into others or removed.",
					"**Parameters.** Names, defaults and accepted values may change.",
					"**Responses.** Fields may be added, renamed or moved.",
					"**Ids.** Measure, dataset, location and crosswalk ids may be renamed.",
				]}
			/>
			<Callout tone="warning" title="Not for production yet">
				Build against the API, but expect to update your code. If
				something you rely on would be hard to change, [open an
				issue](https://github.com/tom-draper/uk-data-atlas/issues) so we
				can weigh it before we change it.
			</Callout>

			<H2 id="stays">What stays the same</H2>
			<List
				items={[
					"**Area codes.** Official codes like `E08000025` are the publishers' own, so they don't change with the API.",
					"**Published values.** Values come back as they were published. A correction gives a new [Atlas release](/docs/v1/concepts/releases), not a quiet edit.",
					"**Read-only, no keys.** The data is openly licensed and needs no API key.",
				]}
			/>

			<H2 id="keeping-up">Keeping up</H2>
			<P>
				The OpenAPI description always describes the API as it's
				currently served, and the [reference](/docs/v1/reference) is
				generated from it. Each response's `atlasRelease` tells you when
				the data behind it has changed.
			</P>
			<EndpointRef id="getOpenapiDescription" />
			<EndpointRef id="getAtlasRelease" />
		</DocPage>
	);
}
