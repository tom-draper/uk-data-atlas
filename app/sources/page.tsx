import type { Metadata } from "next";
import {
	CATALOGUE_DATASET_DEFINITIONS,
	type DatasetSource,
} from "@/lib/data/catalog";

export const metadata: Metadata = {
	title: "Data Sources - UK Data Atlas",
	description:
		"Data sources and licensing information for the UK Data Atlas.",
};

const legacyDatasets: DatasetSource[] = [
	{
		name: "General Election Results",
		source: "House of Commons Library",
		sourceUrl: "https://commonslibrary.parliament.uk/",
		year: "2010, 2015, 2017, 2019, 2024",
		licence: "Open Parliament Licence",
		licenceUrl:
			"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
		description: "General election results by parliamentary constituency.",
	},
	{
		name: "Local Election Results",
		source: "House of Commons Library",
		sourceUrl:
			"https://commonslibrary.parliament.uk/2025-local-elections-handbook-and-dataset/",
		year: "2021, 2022, 2023, 2024, 2025",
		licence: "Open Parliament Licence",
		licenceUrl:
			"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
		description:
			"Local election results by electoral ward for England and Wales.",
	},
	{
		name: "EU Referendum Results",
		source: "Electoral Commission",
		sourceUrl:
			"https://www.electoralcommission.org.uk/research-reports-and-data/our-reports-and-data-past-elections-and-referendums/results-and-turnout-eu-referendum",
		year: "2016",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "EU referendum results by local authority counting area.",
	},
	{
		name: "Population Estimates",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates",
		year: "2020, 2021, 2022",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Population estimates by ward including age and sex breakdown for England and Wales.",
	},
	{
		name: "Ethnicity",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/datasets/TS021/editions/2021/versions/3",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Ethnic group breakdown by local authority district for England and Wales.",
	},
	{
		name: "Qualifications",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/datasets/TS067/editions/2021/versions/3",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Highest level of qualification breakdown by local authority district for England and Wales (Census 2021).",
	},
	{
		name: "House Price",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/medianpricepaidbywardhpssadataset37",
		year: "1995-2023",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Median house price paid by ward for England and Wales.",
	},
	{
		name: "Income",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/placeofworkbylocalauthorityashetable7",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Earnings estimates by local authority for England and Wales.",
	},
	{
		name: "Unemployment",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Model-based unemployment rate estimates by local authority for Great Britain.",
	},
	{
		name: "Claimant Count",
		source: "Office for National Statistics",
		sourceUrl: "https://www.nomisweb.co.uk/datasets/ucjsa",
		year: "2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Claimants of Universal Credit and Jobseeker's Allowance by local authority district for Great Britain.",
	},
	{
		name: "Crime",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/datasets/policeforceareadatatables",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Police recorded crime by local authority district for England and Wales.",
	},
	{
		name: "Indices of Multiple Deprivation",
		source: "Ministry of Housing, Communities & Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/english-indices-of-deprivation-2019",
		year: "2019",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and deciles by small area (LSOA) for England.",
	},
	{
		name: "Scottish Index of Multiple Deprivation",
		source: "Scottish Government",
		sourceUrl:
			"https://www.gov.scot/collections/scottish-index-of-multiple-deprivation-2020/",
		year: "2020",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and quintiles by data zone for Scotland.",
	},
	{
		name: "Welsh Index of Multiple Deprivation",
		source: "Welsh Government",
		sourceUrl: "https://www.gov.wales/welsh-index-multiple-deprivation",
		year: "2019",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and deciles by lower super output area for Wales.",
	},
	{
		name: "Northern Ireland Multiple Deprivation Measure",
		source: "Northern Ireland Statistics and Research Agency",
		sourceUrl:
			"https://www.nisra.gov.uk/statistics/deprivation/northern-ireland-multiple-deprivation-measure-2017-nimdm2017",
		year: "2017",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Deprivation scores, ranks and deciles by super output area for Northern Ireland.",
	},
	{
		name: "Life Expectancy",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasonenglandandwales/2020to2022",
		year: "2020-2022",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Life expectancy and healthy life expectancy estimates by local area for England and Wales.",
	},
	{
		name: "NHS Waiting Times",
		source: "NHS England",
		sourceUrl:
			"https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
		year: "2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Referral to treatment waiting times by Integrated Care Board for England.",
	},
	{
		name: "School Performance (KS4)",
		source: "Department for Education",
		sourceUrl:
			"https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance",
		year: "2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Key Stage 4 performance measures (GCSE results) by local authority district for England.",
	},
	{
		name: "Air Quality",
		source: "Department for Environment, Food and Rural Affairs",
		sourceUrl:
			"https://www.gov.uk/government/statistics/air-quality-statistics",
		year: "2022",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Annual mean concentrations of nitrogen dioxide (NO2) by local authority district.",
	},
	{
		name: "Broadband Coverage",
		source: "Ofcom",
		sourceUrl:
			"https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Fixed broadband coverage by local authority district across the UK.",
	},
	{
		name: "Westminster Parliamentary Wards (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "December 2021, 2022, 2023, 2024, May 2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Electoral ward boundaries.",
	},
	{
		name: "Local Authority Districts (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "December 2021, 2022, 2023, 2024, May 2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Local authority district boundaries.",
	},
	{
		name: "Westminster Parliamentary Constituencies (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "2015, 2017, 2019, July 2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Parliamentary constituency boundaries.",
	},
];

const datasets: DatasetSource[] = [
	...CATALOGUE_DATASET_DEFINITIONS.map((definition) => definition.source),
	...legacyDatasets,
].filter(
	(dataset, index, entries) =>
		entries.findIndex((candidate) => candidate.name === dataset.name) ===
		index,
);

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
