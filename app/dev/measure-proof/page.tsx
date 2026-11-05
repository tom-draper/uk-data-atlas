import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeasureProof } from "@/components/measures/MeasureProof";

export const metadata: Metadata = {
	title: "Measure query proof",
	robots: { index: false, follow: false },
};

type Props = {
	searchParams: Promise<{
		measure?: string;
		geography?: string;
		boundaryYear?: string;
	}>;
};

/**
 * One measure drawn through the website's measure query. A development page:
 * it is a 404 in production unless MEASURE_PROOF=1, because it is a proof of
 * the approach (see docs/website-measure-queries.md), not a product page.
 */
export default async function MeasureProofPage({ searchParams }: Props) {
	if (
		process.env.NODE_ENV === "production" &&
		process.env.MEASURE_PROOF !== "1"
	)
		notFound();
	const {
		measure = "population",
		geography = "localAuthority",
		boundaryYear = "2023",
	} = await searchParams;
	const year = Number(boundaryYear);
	if (!/^[a-z0-9-]+$/.test(measure) || !Number.isInteger(year)) notFound();
	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
			<h1 className="text-2xl font-semibold">Measure query proof</h1>
			<MeasureProof
				measure={measure}
				geography={geography}
				boundaryYear={year}
			/>
		</main>
	);
}
