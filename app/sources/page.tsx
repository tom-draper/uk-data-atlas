"use client";

interface Dataset {
	name: string;
	source: string;
	sourceUrl: string;
	year: string;
	licence: string;
	licenceUrl: string;
	description: string;
}

const datasets: Dataset[] = [
	{
		name: "General Election Results",
		source: "House of Commons Library",
		sourceUrl: "https://www.electoralcommission.org.uk/",
		year: "2010, 2015, 2017, 2019, 2024",
		licence: "Open Parliament Licence",
		licenceUrl:
			"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
		description:
			"General election results by parliamentary constituency.",
	},
	{
		name: "Local Election Results",
		source: "House of Commons Library",
		sourceUrl: "https://commonslibrary.parliament.uk/2025-local-elections-handbook-and-dataset/",
		year: "2021, 2022, 2023, 2024, 2025",
		licence: "Open Parliament Licence",
		licenceUrl:
			"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
		description:
			"Local election results by electoral ward for England and Wales.",
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
		sourceUrl: "https://www.ons.gov.uk/datasets/TS021/editions/2021/versions/3",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Ethnic group breakdown by local authority district for England and Wales.",
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
		description:
			"Median house price paid by ward for England and Wales.",
	},
	{
		name: "EU Referendum Results",
		source: "Electoral Commission",
		sourceUrl: "https://www.electoralcommission.org.uk/research-reports-and-data/our-reports-and-data-past-elections-and-referendums/results-and-turnout-eu-referendum",
		year: "2016",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"EU referendum results by local authority counting area.",
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
		name: "Westminster Parliamentary Wards (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "December 2021, 2022, 2023, 2024, May 2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Electoral ward boundaries.",
	},
	{
		name: "Local Authority Districts (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "December 2021, 2022, 2023, 2024, May 2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Local authority district boundaries.",
	},
	{
		name: "Westminster Parliamentary Constituencies (Boundaries)",
		source: "ONS Open Geography Portal",
		sourceUrl: "https://geoportal.statistics.gov.uk/",
		year: "2015, 2017, 2019, July 2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Parliamentary constituency boundaries.",
	},
];

export default function DatasetsPage() {
	return (
		<div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-8"
			style={{
				backgroundImage: "url(/map-background.png)",
				backgroundSize: "cover",
				minHeight: "100vh",
			}}
		>
			<div className="max-w-5xl mx-auto">
				<h1 className="text-5xl font-bold text-white/40 text-shadow ml-4 mt-[12vh] mb-8">
					Datasets
				</h1>

				<div className="bg-[rgba(255,255,255,0.7)] rounded-lg backdrop-blur-md shadow-sm border border-white/40 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="bg-white/50 border-b border-white/30">
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
										Dataset
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
										Source
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
										Year
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
										Licence
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
										Description
									</th>
								</tr>
							</thead>
							<tbody>
								{datasets.map((dataset, idx) => (
									<tr
										key={idx}
										className={`border-b border-white/20 hover:bg-white/30 transition-colors duration-150 last:border-b-0 ${
  idx % 2 === 0 ? 'bg-white/10' : 'bg-white/30'
}`}
									>
										<td className="px-6 py-4 text-sm font-medium text-gray-900">
											{dataset.name}
										</td>
										<td className="px-6 py-4 text-sm text-gray-700">
											<a
												href={dataset.sourceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-600 hover:text-blue-700 underline"
											>
												{dataset.source}
											</a>
										</td>
										<td className="px-6 py-4 text-sm text-gray-700">
											{dataset.year}
										</td>
										<td className="px-6 py-4 text-sm text-gray-700">
											<a
												href={dataset.licenceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-600 hover:text-blue-700 underline"
											>
												{dataset.licence}
											</a>
										</td>
										<td className="px-6 py-4 text-sm text-gray-600">
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
