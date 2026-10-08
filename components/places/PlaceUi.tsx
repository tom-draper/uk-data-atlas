import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs, Card, Eyebrow } from "@/components/docs/Page";
import { PLACE_OPERATIONS, type PlaceRequest } from "@/lib/places/api";
import {
	areaHref,
	geographyNoun,
	listNames,
	namedHref,
	namedKindName,
} from "@/lib/places/labels";
import {
	releaseLabel,
	type AreaGroup,
	type DatasetCoverage,
	type NamedRef,
} from "@/lib/places/profile";
import { JsonLd, placeJsonLd } from "@/lib/atlas/structuredData";

export const linkClass =
	"text-slate-800 underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

export function Section({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section id={id} className="mt-10 scroll-mt-24">
			<h2 className="text-[20px] font-semibold tracking-tight text-slate-900">
				{title}
			</h2>
			<div className="mt-3 text-[15px] leading-relaxed text-slate-600">
				{children}
			</div>
		</section>
	);
}

export function Facts({
	items,
}: {
	items: { label: string; value: ReactNode }[];
}) {
	return (
		<dl
			className={`mt-6 grid grid-cols-2 gap-x-6 gap-y-4 ${items.length > 4 ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}
		>
			{items.map((item) => (
				<div key={item.label} className="min-w-0">
					<dt className="text-[13px] text-slate-500">{item.label}</dt>
					<dd className="mt-0.5 text-[15px] font-medium text-slate-900">
						{item.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

export function PlaceLink({
	href,
	children,
}: {
	href?: string;
	children: ReactNode;
}) {
	return href ? (
		<Link href={href} className={linkClass}>
			{children}
		</Link>
	) : (
		<span className="text-slate-800">{children}</span>
	);
}

/** Rows of label and value, for what a place sits within. */
export function Rows({
	rows,
}: {
	rows: { label: string; value: ReactNode }[];
}) {
	return (
		<Card className="divide-y divide-slate-900/[0.06]">
			{rows.map((row) => (
				<div
					key={row.label}
					className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-2.5"
				>
					<span className="w-[190px] shrink-0 text-[13px] text-slate-500">
						{row.label}
					</span>
					<span className="min-w-0 flex-1 text-[15px]">
						{row.value}
					</span>
				</div>
			))}
		</Card>
	);
}

export function NamedLinks({ places }: { places: NamedRef[] }) {
	return places.map((place, index) => (
		<span key={place.id}>
			{index > 0 && ", "}
			<PlaceLink href={namedHref(place)}>{place.label}</PlaceLink>
		</span>
	));
}

/** Named places grouped by kind, as rows. */
export function namedRows(places: NamedRef[]) {
	const order = [
		"country",
		"region",
		"combined-authority",
		"county",
		"ceremonial-county",
		"historic-county",
		"editorial-grouping",
	];
	const kinds = [...new Set(places.map((place) => place.kind))].sort(
		(a, b) => order.indexOf(a) - order.indexOf(b),
	);
	return kinds.map((kind) => ({
		label: namedKindName(kind),
		value: (
			<NamedLinks
				places={places.filter((place) => place.kind === kind)}
			/>
		),
	}));
}

export function AreaGroups({ groups }: { groups: AreaGroup[] }) {
	return (
		<div className="space-y-5">
			{groups.map((group) => (
				<div key={group.geography}>
					<p className="text-[14px] text-slate-500">
						{group.count.toLocaleString("en-GB")}{" "}
						{geographyNoun(group.geography, group.count !== 1)}, as
						of the {releaseLabel(group.release)} boundaries
					</p>
					{group.areas && (
						<ul className="mt-2 columns-2 gap-x-6 text-[14.5px] sm:columns-3">
							{group.areas.map((area) => (
								<li
									key={area.code}
									className="break-inside-avoid py-0.5"
								>
									<PlaceLink href={areaHref(area)}>
										{area.name}
									</PlaceLink>
								</li>
							))}
						</ul>
					)}
				</div>
			))}
		</div>
	);
}

/** Newest first: `2023`, `2021 and 2023`, `2016 to 2023 (6 years)`. */
function yearsLabel(years: number[]) {
	const sorted = [...years].sort((a, b) => a - b);
	if (sorted.length <= 2) return listNames(sorted.map(String));
	return `${sorted[0]} to ${sorted.at(-1)} (${sorted.length} years)`;
}

export function Datasets({ datasets }: { datasets: DatasetCoverage[] }) {
	return (
		<ul className="divide-y divide-slate-900/[0.06]">
			{datasets.map((dataset) => (
				<li
					key={dataset.slug}
					className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
				>
					<Link
						href={`/datasets#${dataset.slug}`}
						className={linkClass}
					>
						{dataset.title}
					</Link>
					<span className="text-[13px] text-slate-500">
						{yearsLabel(dataset.years)}
					</span>
				</li>
			))}
		</ul>
	);
}

export function ApiRequests({ requests }: { requests: PlaceRequest[] }) {
	return (
		<Card className="overflow-hidden">
			<ul className="divide-y divide-slate-900/[0.06]">
				{requests.map((request) => (
					<li key={request.path} className="px-4 py-3">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4">
							<span className="text-[14px] font-medium text-slate-800">
								{request.label}
							</span>
							<Link
								href={PLACE_OPERATIONS[request.operationId]}
								className="text-[13px] text-slate-500 hover:text-slate-900"
							>
								Docs
							</Link>
						</div>
						<code className="mt-1 block overflow-x-auto font-mono text-[12.5px] whitespace-nowrap text-slate-600">
							<span className="mr-2 font-semibold text-emerald-700">
								GET
							</span>
							{request.path}
						</code>
					</li>
				))}
			</ul>
		</Card>
	);
}

/** Breadcrumbs, title and lede, with the page's structured data. */
export function PlaceHeader({
	path,
	place,
	trail,
	eyebrow,
	title,
	lede,
	pill,
}: {
	path: string;
	place: Parameters<typeof placeJsonLd>[0]["place"];
	trail: { label: string; href?: string }[];
	eyebrow: string;
	title: string;
	lede: ReactNode;
	pill: ReactNode;
}) {
	return (
		<>
			<JsonLd data={placeJsonLd({ path, title, trail, place })} />
			<Breadcrumbs trail={trail} />
			<Eyebrow>{eyebrow}</Eyebrow>
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
					{title}
				</h1>
				{pill}
			</div>
			<p className="mt-3 max-w-[760px] text-[17px] leading-[1.7] text-slate-600">
				{lede}
			</p>
		</>
	);
}

/** The page body: content on the left, a sticky card on the right. */
export function PlaceLayout({
	aside,
	children,
}: {
	aside: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
			<div className="min-w-0">{children}</div>
			<aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
				<Card className="p-5">{aside}</Card>
			</aside>
		</div>
	);
}
