import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import { paperCard } from "@/lib/docs/theme";
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
		<div className="relative min-h-screen overflow-hidden bg-[#f3f3f1]">
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-[url('/map-background.png')] bg-cover bg-center opacity-45"
			/>
			<div className="relative z-10">
				<Navigation />
				<main className="mx-auto max-w-[1320px] px-4 pt-16 pb-16 sm:px-8 lg:px-12">
					<div className="max-w-[760px]">
						<p className="mb-2 text-[14px] font-medium text-slate-500">
							Datasets
						</p>
						<h1 className="text-[38px] leading-[1.08] font-semibold tracking-tight text-slate-900 sm:text-[50px]">
							Data wired into the Atlas
						</h1>
						<p className="mt-5 text-[18px] leading-[1.65] text-slate-600">
							The official datasets currently connected to the UK
							Data Atlas map. Sources, years and licences are
							listed so you can see where each layer comes from.
						</p>
					</div>

					<div
						className="mt-10 overflow-hidden rounded-md"
						style={paperCard}
					>
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
					</div>
				</main>
			</div>
		</div>
	);
}
