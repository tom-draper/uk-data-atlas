import type { Metadata } from "next";
import { DATASET_SOURCES } from "@/lib/data/catalog";

export const metadata: Metadata = {
	title: "Data Sources - UK Data Atlas",
	description:
		"Data sources and licensing information for the UK Data Atlas.",
};

const datasets = DATASET_SOURCES;

export default function DatasetsPage() {
	return (
		<div
			className="min-h-screen p-8"
			style={{
				backgroundImage: "url(/map-background-dark.png)",
				backgroundSize: "cover",
				minHeight: "100vh",
			}}
		>
			<div className="max-w-5xl mx-auto">
				<h1 className="text-5xl font-bold text-white/20 ml-4 mt-[12vh] mb-8">
					Datasets
				</h1>

				<div className="rounded-lg backdrop-blur-xl shadow-lg border border-white/10 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="bg-white/10">
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-200">
										Dataset
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-200">
										Source
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-200">
										Year
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-200">
										Licence
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-200">
										Description
									</th>
								</tr>
							</thead>
							<tbody>
								{datasets.map((dataset, idx) => (
									<tr
										key={dataset.name}
										className={`hover:bg-white/10 transition-colors duration-150 ${
											idx % 2 !== 0 ? "bg-black/20" : ""
										}`}
									>
										<td className="px-6 py-4 text-sm font-medium text-gray-100">
											{dataset.name}
										</td>
										<td className="px-6 py-4 text-sm text-gray-400">
											<a
												href={dataset.sourceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-indigo-400 hover:text-indigo-300 underline"
											>
												{dataset.source}
											</a>
										</td>
										<td className="px-6 py-4 text-sm text-gray-400">
											{dataset.year}
										</td>
										<td className="px-6 py-4 text-sm text-gray-400">
											<a
												href={dataset.licenceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-indigo-400 hover:text-indigo-300 underline"
											>
												{dataset.licence}
											</a>
										</td>
										<td className="px-6 py-4 text-sm text-gray-500">
											{dataset.description}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
