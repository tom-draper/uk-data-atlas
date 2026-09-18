import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import { Card, Eyebrow, Sheet } from "@/components/docs/Page";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog/registry";

export const metadata: Metadata = {
	title: "Datasets - UK Data Atlas",
	description:
		"Datasets wired into the UK Data Atlas, with their sources, coverage and licences.",
};

const datasets = CATALOGUE_DATASET_DEFINITIONS.map(
	(definition) => definition.source,
);

export default function DatasetsPage() {
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<div className="max-w-[760px]">
						<Eyebrow>Datasets</Eyebrow>
						<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
							Data wired into the Atlas
						</h1>
						<p className="mt-4 text-[17px] leading-[1.7] text-slate-600">
							The official datasets currently connected to the UK
							Data Atlas map. Sources, years and licences are
							listed so you can see where each layer comes from.
						</p>
					</div>

					<Card className="mt-9 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left text-[14px]">
								<thead>
									<tr className="border-b border-slate-900/[0.07]">
										{[
											"Dataset",
											"Source",
											"Year",
											"Licence",
											"Description",
										].map((heading) => (
											<th
												key={heading}
												className="px-4 py-3 text-[12px] font-semibold tracking-wide whitespace-nowrap text-slate-500"
											>
												{heading}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-900/[0.05]">
									{datasets.map((dataset) => (
										<tr
											key={dataset.name}
											className="align-top transition-colors hover:bg-white/60"
										>
											<td className="px-4 py-3 leading-relaxed font-medium text-slate-900">
												{dataset.name}
											</td>
											<td className="px-4 py-3 leading-relaxed text-slate-600">
												<a
													href={dataset.sourceUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="font-medium text-slate-800 underline decoration-slate-400 underline-offset-[3px] hover:decoration-slate-700"
												>
													{dataset.source}
												</a>
											</td>
											<td className="px-4 py-3 leading-relaxed whitespace-nowrap text-slate-600">
												{dataset.year}
											</td>
											<td className="px-4 py-3 leading-relaxed text-slate-600">
												<a
													href={dataset.licenceUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="font-medium text-slate-800 underline decoration-slate-400 underline-offset-[3px] hover:decoration-slate-700"
												>
													{dataset.licence}
												</a>
											</td>
											<td className="max-w-[520px] px-4 py-3 leading-relaxed text-slate-600">
												{dataset.description}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Card>
				</Sheet>
			</main>
		</div>
	);
}
