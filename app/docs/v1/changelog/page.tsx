import { DocPage, H2, List, P } from "@/components/docs/Content";
import { CHANGELOG } from "@/lib/docs/content/changelog";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Changelog",
	"Changes to the UK Data Atlas API that clients might notice, newest first, with breaking changes marked.",
	"/docs/v1/changelog",
);

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

export default function ChangelogPage() {
	return (
		<DocPage
			href="/docs/v1/changelog"
			eyebrow="Get started"
			title="Changelog"
			lede="Changes to the API that you might notice, newest first. During early access some will break existing requests, and those are marked."
			toc={CHANGELOG.map((entry) => ({
				id: entry.date,
				title: entry.title,
			}))}
		>
			{CHANGELOG.map((entry) => (
				<section key={entry.date}>
					<H2 id={entry.date}>{entry.title}</H2>
					<P>
						{`${DATE_FORMAT.format(new Date(entry.date))}${entry.breaking ? ". **Breaking.**" : ""}`}
					</P>
					<List items={entry.changes} />
				</section>
			))}
		</DocPage>
	);
}
