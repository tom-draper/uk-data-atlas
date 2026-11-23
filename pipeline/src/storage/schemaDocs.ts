/**
 * What every table, view and column of `atlas.sqlite` means, in plain words
 * for an analyst or an agent. `writeSchemaDocs` stores it in the file as
 * `schema_table`, `schema_column`, `schema_guide` and `schema_example`, and
 * fails the build when it drifts from the tables the writers create.
 *
 * Audience: `core` is where to start, `reference` holds provenance, quality and
 * detail, and `internal` is build or API plumbing that needs only a table
 * description.
 */
export type SchemaAudience = "core" | "reference" | "internal";

/** Columns that share a suffix, such as one per boundary release of a postcode. */
export type ColumnPattern = {
	/** How to read the family of columns, for people. */
	pattern: string;
	/** A column belongs to the family when it ends with this and has more before it. */
	suffix: string;
	description: string;
};

export type TableDoc = {
	audience: SchemaAudience;
	description: string;
	/** Column descriptions. An internal table may leave this empty. */
	columns: Readonly<Record<string, string>>;
	columnPatterns?: readonly ColumnPattern[];
};

export type GuideTopic = { topic: string; body: string };

export type SchemaExample = {
	id: string;
	question: string;
	sql: string;
	/** What the query returns, so a reader can check their copy. */
	expect: string;
};

export type SchemaDocs = {
	guide: readonly GuideTopic[];
	tables: Readonly<Record<string, TableDoc>>;
	examples: readonly SchemaExample[];
};

export const schemaGuide: readonly GuideTopic[] = [
	{
		topic: "measure-semantics",
		body: "Join measure.unit_id to unit for kind, scale, currency and symbol, and universe_id to universe for the population or entity base. For percent and per_n, unit scale is the denominator (100 for percent). For count and currency units expressed in thousands or millions it multiplies the published value; otherwise it is 1. Every measure names its base: unknown is reserved and no published measure uses it, and not-applicable is used only for totals such as tonnes or pounds that are not statistics over a population, each with a reason checked at build. statistic describes the statistic and unit_id the unit, and nothing else stores a value kind or unit text. When statistic is by-dimension, join statistic_dimension_id to dimension and inspect series_member for the member. In the pay measures this is pay-statistic: mean, median or a percentile. For pay-change measures it selects the underlying pay statistic whose percentage change is reported. Five published weighted means have no linkable weight (the PM2.5 population-weighted pair, Band D council tax, mobile area coverage and Progress 8). Conversion reads a weight from the same dataset as the measure, so it refuses them and measure_conversion gives each reason.",
	},
	{
		topic: "start-here",
		body: "atlas.sqlite holds UK statistics and the geography they are published on. Areas (councils, wards, constituencies, LSOAs and others) are in area and area_version, statistics are in observation, and crosswalks say how areas in one boundary release map onto another. Read schema_table for what each table is for, schema_column for every column, and schema_example for worked questions with tested SQL. Tables with audience 'core' are enough for most questions. The v_ views join the core tables into readable rows: v_coverage for what exists and how complete it is, v_observation_default for one safe value per quantity, area and period, v_observation for every statistic, v_series for what a dataset holds, v_area_version for areas, v_area_current for each area's latest name, v_crosswalk_edge and v_crosswalk_weight for crosswalks, v_crosswalk_chain_edge for old code to current code in one join, v_area_change for areas that were renamed, recoded, redrawn, split, merged, ended or created, v_contest and v_candidacy for elections, v_source_terms and v_election_terms for licences, v_series_attribution for every source, publisher and licence a series depends on (converted and modelled series included) and v_series_terms for whether a series is commercial-safe or ShareAlike with the attribution text to print. search is a full-text index over measures, datasets, dimension members, areas and places: SELECT kind, key, label FROM search WHERE search MATCH 'household*' ORDER BY rank.",
	},
	{
		topic: "areas-and-releases",
		body: "An area is one code in one geography, for all time (area). Boundaries are published in dated releases, such as localAuthority 2025-05-uk-bgc-v2, listed in area_release and described in boundary_release. An area_version is an area as it is in one release, with that release's name, size and population. The same code in two releases is two area_version rows sharing one area_id. Every statistic is attached to an area_version, so it is always clear which boundaries a figure is on. Some codes appear in more than one geography, for example a metropolitan borough is both a localAuthority and a countyAndUnitaryAuthority, so filter on geography when looking up a code. Release slugs read as YYYY-MM, then the countries covered (uk, gb, ew, en, sc, w, ni), then the boundary detail (bgc generalised and clipped, bfc full and clipped), then a version suffix if the publisher revised it.",
	},
	{
		topic: "statistics",
		body: "A measure is what is counted, in one unit (population, recorded-crimes, unemployment-rate). A dimension is a breakdown of a measure (sex, age, offence, tenure, party) and a dimension_member is one value of it (offence=burglary). Members can have a parent, and the total is usually the root member with code 'total' or 'all'. A series is one dataset's figures for one measure, one set of members and one boundary release. An observation is one value of a series for one area_version and one period. In v_observation the members column lists the fixed members as 'dimension=code; dimension=code'. A measure with dimensions has one series per combination of members, so filter members (or join series_member) to avoid adding a total to its own parts, or read v_observation_default, which does it for you (see which-view-to-use).",
	},
	{
		topic: "which-view-to-use",
		body: "Check v_coverage first, before reading any observation: it says in one query whether a measure exists for a geography, release and period, by which method, and how complete it is. Filter it by measure, geography, release and period, with no joins: SELECT period, method, dataset, share, countries FROM v_coverage WHERE measure = 'population' AND geography = 'localAuthority' ORDER BY release, period. share is areas_with_value divided by release_areas, the areas the release holds, so 0.9 is nine areas in ten. A measure that is only published for the areas that polled (election results) or for one nation (countries) has a small share and is not broken. is_default is 1 for the series v_observation_default prefers, and a series that is a part of a total has no quantity. For a converted series exact_share and coverage say how far to trust it. When v_coverage has no row, read v_coverage_missing: SELECT reason, explanation, dataset, source_release FROM v_coverage_missing WHERE measure = 'claimant-rate' AND geography = 'ward'. It gives the reason a measure was not moved onto a release (refused-measure, no-route and the others in conversion_skip). It lists only the combinations the conversion planner considered: a measure with no row in either view has no series and was never a candidate for that release. Then start reading values with v_observation_default. It has the columns of v_observation and returns one row for each quantity, area and period, so a sum or a count over it does not count a figure twice. A quantity is a measure on one boundary release with one member of each qualifier dimension: life expectancy for females and for males are two quantities, and so is the same measure on two releases (filter on release to choose one). measure_dimension says how each dimension of a measure is read. A breakdown dimension (tenure, age band, residence type) splits a total, so the view keeps only the series at the total (default_member_id, or the series with no member of that dimension when it is NULL) and leaves out the parts. A qualifier dimension (sex for life expectancy, party for votes, pay statistic) has no total, so each member is its own quantity and all of them are in the view. Where several series hold one quantity, the best one is returned for each area and period: published, then aggregated, then modelled (an open model before a ShareAlike one), then converted, then the dataset order declared for the measure. series_preference holds the order (rank 1 is best) and quantity names the group. The column alternatives counts the other series that also have a row for that quantity, area and period, so a value of 0 means there was no choice. A series is passed over only where it has no observation row: a row whose value is NULL (a suppressed figure) is the answer for that area and period and the next series is not tried. Use v_observation instead when you want every series, a breakdown (members = age-band=...), or a comparison between datasets or methods, and v_series to see what exists. In a database assembled from some modules only the series that are present are ranked, so the view returns the best of what is there.",
	},
	{
		topic: "published-and-converted",
		body: "series.method is 'published' for figures as the publisher released them, or 'converted' for figures the atlas moved onto a newer boundary release through a crosswalk. A converted series names its inputs in series_input, its route in series_crosswalk, and its rule, weight basis and quality in series_conversion: exact_share is the share of its values that came from regrouping whole areas (1 = no estimation), and coverage is the share of target areas that received a value. Converted values have status 'derived' (exact regrouping) or 'estimated' (split by a weight, with lower and upper bounds). series_gap says why a converted area or period has no value. A question about one area on one boundary release should usually use one method; when both exist, prefer published, and say when a figure is converted. A 'modelled' series is an estimate the atlas made from several sources, named by its model in series_model: model says what it is, the share-alike licence it carries (licence_id), and model_input what it read. The notional 2019 general election on the 2024 constituencies is modelled, with key suffix ~notional-open or ~notional-sharealike; a seat made of whole 2019 seats has 'derived' values, any other 'estimated' values with bounds. Each model also has notional valid-votes and majority on 2019's period, and party-vote-share-change (2024 share less notional 2019 share, in points, Reform against the Brexit Party) on 2024's; swing is half the difference of two parties' changes. Say when a figure is modelled, and do not mix the two notional models.",
	},
	{
		topic: "periods-and-status",
		body: "Each kind has one label format (year 2024, financial_year 2024-25, academic_year 2024/25, quarter 2026-Q1, month 2026-03, range 2022-2024, date 2024-07-04), but formats differ between kinds, so sort and compare by start_date and end_date, which are ISO dates. period.kind says what the period is (year, financial_year, academic_year, quarter, month, date, range). Election results use the polling day as a date period. status says how far to trust a value: observed, estimated, provisional, suppressed (value withheld by the publisher, value is null), not_applicable, derived (computed exactly from other values).",
	},
	{
		topic: "aggregating",
		body: "measure.aggregation says how values combine across areas. 'sum' measures (counts, amounts) can be added. 'ratio' measures are rebuilt from their numerator_id and denominator_id measures, never averaged. 'weighted_mean' measures are averaged using weight_id as the weight. 'none' means the measure cannot be combined (medians, ranks, indices, model-based rates). measure_conversion gives the same rule for boundary conversion with the reason a measure is refused. To total a sum measure for a larger area, join its smaller areas through a membership crosswalk (crosswalk.purpose = 'membership', or method 'official-lookup') and add.",
	},
	{
		topic: "crosswalks",
		body: "A crosswalk relates the areas of one release (from_release_id) to the areas of another (to_release_id). Each crosswalk_edge pairs one from area_version with one to area_version. crosswalk.method says how it was made: official-lookup and clean-containment come from the publisher, best-fit assigns each source area to one target, extent-continuity links the same area across releases, and area-overlap, population-overlap and postcode-overlap split areas by measured overlap. crosswalk_weight holds the weight of an edge on a basis (weight_basis: area, population, households, dwellings, postcodes); weight is the share of the source area on that basis that falls in the target, summing to 1 per source. v_crosswalk_weight also includes the implicit weight of 1 for edges that regroup a whole area. To move a count from one release to another, multiply each source value by its weight on a basis that suits the measure (residents for people, households for households) and sum per target. To move a count from any older release straight to the geography's current release, join v_crosswalk_chain_edge on from_code instead: it holds the weight along the whole chain of crosswalks, the bounds the backtest puts on it, and complete, which is 0 where a current area is short of a feeder. crosswalk_chain and crosswalk_chain_hop say which crosswalks a chain was made from, and v_crosswalk_chain_gap lists the old areas that lose part or all of their value on the way (an old area missing from v_crosswalk_chain_edge is one of them).",
	},
	{
		topic: "boundary-changes",
		body: "Start with v_area_change, which lists what happened to each area whose code, name or extent changed between two releases of one geography. Each event (area_change_event) has a kind (renamed, recoded, redrawn, split, merged, redistributed, ended or created), the two releases and an effective_date, and its areas are the members on the from side (the earlier release) and the to side. What replaced Allerdale: SELECT * FROM v_area_change WHERE event_id IN (SELECT event_id FROM v_area_change WHERE code = 'E07000026' AND side = 'from'). An event's effective_date is its legal date where the ONS Code History Database has one (date_basis 'legal'), and otherwise the later release's edition date (date_basis 'edition'), by which the change had happened but not necessarily on which day. The legal date is the operative date of a predecessor and successor pair the event links or, for a created or ended area, the day its code came into or went out of use. It counts only if it lies between the earlier release's edition date and the end of the later edition's month, and the earliest such date is used. Renamed and redrawn events, and areas the database does not cover (ITL areas, Scottish Parliamentary constituencies), keep the edition date, which stays available as edition_date. Compare the two to see how far an edition lags the law. Events come from the identity crosswalks, which link releases of one geography. Official lookups show splits, merges and redistributions: local authorities 2022 to 2023 and 2024 to 2025, LSOA 2011 to 2021, the 2010 to 2024 constituency lookup, and the ONS Code History Database for wards, parishes, local authorities, output areas, LSOAs and MSOAs (every consecutive pair of the releases that has a change: wards 2011 to 2026, parishes 2019 to 2026, local authorities 2008 to 2009 and 2018 to 2021, output areas, LSOAs and MSOAs across the 2001, 2011 and 2021 censuses). Each event's basis says how it was found: 'official-lookup' for a publisher's lookup, 'extent-continuity' for the geometric comparison, which only links areas whose extent did not change. Where there is no lookup (Scottish and Northern Irish areas, constituencies before 2010, ITL areas, and any release pair the Code History Database does not cover), a split or merge shows as ended and its successors as created: filter on basis before treating a missing split as no split. Where the Code History Database does not name an area's successors either, the area stays ended or created: 130 ended and 180 created areas remain, of which 88 and 87 are wards and 30 and 38 are ITL areas. An area that kept its code but whose extent moved has a 'redrawn' event, and where the extent-continuity crosswalk finds the area's successor across a small realignment, the event has realigned = 1: a ward moved by a street is recoded or redrawn with realigned 1, not ended and created. Official lookups with no declared purpose between two releases of one geography (constituencies 2019 to 2024) count as identity crosswalks too. Publisher statements (area_relationship, relation 'predecessor') add events only where no crosswalk event already holds them. Documented edition replacements without a compiled predecessor lookup add ended and created events for codes present on only one side. Both use source 'publisher'. The crosswalk_edge.change flag (unchanged, split, merged or complex) exists on the LSOA 2011 to 2021 lookup only. area_relationship also holds a publisher's statements that an area sits inside another ('parent'), was published under another's code ('published-as') or has the same extent ('coterminous'); for example Cumberland E06000063 has predecessors Allerdale E07000026 and Carlisle E07000028.",
	},
	{
		topic: "licences",
		body: "Every dataset names a source, and every source has one or more licences (source_licence, licence). licence.commercial_use and licence.share_alike are 0 or 1. v_source_terms rolls them up per source: commercial_use is 1 only if every licence allows it, share_alike is 1 if any licence requires it. Election results can carry their own licence (v_election_terms). Most data is under the Open Government Licence v3.0, which needs attribution. The 2016 to 2019 local elections are CC BY-SA, so anything derived from them must be shared alike. Citing and licences of a series: a series depends on more than its dataset's source, since a converted series also rests on its input, its crosswalks, the weights those were counted from and the boundary files, and a modelled series on everything its model read. v_series_attribution lists every source of a series, one row each, with publisher, licences, terms and how it was reached: SELECT source_id, publisher, licences, commercial_use, share_alike, via FROM v_series_attribution WHERE series_id = ? ORDER BY depth. v_series_terms has one row per series with the terms rolled up over all of them (commercial_use is the lowest, share_alike the highest, null when a source has no licence on record) and attribution, the text to print: SELECT commercial_use, share_alike, attribution FROM v_series_terms WHERE series_id = ?. Take series_id from the row you read (v_observation_default and v_observation return it). A series built from ShareAlike inputs is ShareAlike. The two notional election models differ only in this: notional-open read no CC BY-SA result and notional-sharealike did. A source that is under different licences in different years (the local election archive) counts as the licence of the years a series holds, so a series of 2021 to 2025 results is not ShareAlike. Print the attribution with any figure you show; a derived figure credits everything it is made from.",
	},
	{
		topic: "performance",
		body: "observation is keyed by (series_id, area_version_id, period_id) with no other index. Filtering v_observation or v_observation_default on measure and area_code is fast (milliseconds), and on measure, geography and release it reads one release's series. A query that filters only on area_version_id, or only on period, scans the whole table (about 10.7 million rows). To read everything for one area, first find its series through its release: WHERE series_id IN (SELECT id FROM series WHERE release_id = ?) AND area_version_id = ?.",
	},
];

export const schemaTables: Readonly<Record<string, TableDoc>> = {
	area_location: {
		audience: "core",
		description:
			"A representative point and bounding box for each area version, or a reason geometry is unavailable. Matching 2021 England and Wales output areas use published ONS population-weighted centroids when inside the bounding box; others use polygon interior points.",
		columns: {
			area_version_id: "Area version (area_version.id).",
			longitude: "Representative point longitude in WGS84 degrees.",
			latitude: "Representative point latitude in WGS84 degrees.",
			min_longitude:
				"Western bound in WGS84 degrees, rounded outward to six decimal places.",
			min_latitude:
				"Southern bound in WGS84 degrees, rounded outward to six decimal places.",
			max_longitude:
				"Eastern bound in WGS84 degrees, rounded outward to six decimal places.",
			max_latitude:
				"Northern bound in WGS84 degrees, rounded outward to six decimal places.",
			method: "ons-population-weighted-2021: published ONS 2021 England and Wales output-area centroid; polygon-interior-point: a scanline point strictly inside the polygon, not population weighted.",
			gap: "no-geometry or no-interior-point when no location could be calculated; otherwise null.",
		},
	},
	geography: {
		audience: "core",
		description:
			"A kind of area, such as localAuthority, ward, constituency or lsoa. One row per geography.",
		columns: {
			id: "Stable integer id.",
			slug: "Geography name used throughout the database, in camelCase (localAuthority, countyAndUnitaryAuthority, outputArea).",
		},
	},
	area: {
		audience: "core",
		description:
			"One area code in one geography, for all time. The same code in different boundary releases is one area with several area_version rows.",
		columns: {
			id: "Stable integer id, assigned once and never reused.",
			geography_id: "The area's geography (geography.id).",
			code: "The official code, such as E08000003 for Manchester or E05011234 for a ward. Unique within a geography, but the same code can appear in two geographies.",
		},
	},
	area_version: {
		audience: "core",
		description:
			"An area as it is in one boundary release: its name, size and population in that release. Statistics and crosswalks refer to area versions, not areas.",
		columns: {
			id: "Stable integer id, assigned once and never reused.",
			area_id:
				"The area (area.id). Versions of the same code in different releases share it.",
			release_id: "The boundary release (area_release.id).",
			name: "The area's name in this release. Empty for areas only known from a code list, where in_inventory is 0.",
			area_m2:
				"Land area in square metres, from the release's boundaries. Null if not measured.",
			population:
				"Resident population used to weight this release, where held. Null otherwise.",
			aliases:
				"JSON array of other names for the area, such as a Welsh name. Null when none are recorded.",
			in_inventory:
				"1 if the area is in the release's boundary file, 0 if it is only referenced by a lookup or postcode file.",
			inventory_position:
				"The area's order in the release's boundary file. Null when in_inventory is 0.",
		},
	},
	area_release: {
		audience: "core",
		description:
			"Every boundary release of every geography. series, crosswalk, election and area_version refer to it through release_id. boundary_release holds the publisher's description of the same release.",
		columns: {
			id: "Stable integer id, assigned once.",
			geography: "The geography slug (geography.slug).",
			release:
				"The release slug, such as 2025-05-uk-bgc-v2: year and month, countries covered, boundary detail and version.",
			inventory_position:
				"Build order of the release. Not stable between builds.",
			status: "'available' if the release's areas are held, otherwise 'unavailable' with a reason.",
			reason: "Why an unavailable release is not held. Null for available releases.",
		},
	},
	boundary_release: {
		audience: "core",
		description:
			"The publisher's description of a boundary release: title, period covered, publisher, licence and deprecation. Keyed by geography and release slug, matching area_release.",
		columns: {
			geography: "The geography slug.",
			release: "The release slug.",
			title: "Human-readable title, such as 'Wards, May 2025 (UK, generalised, clipped)'.",
			description: "Longer description from the boundary registry.",
			temporal_coverage:
				"The year or years the boundaries describe, as the registry states them.",
			reference_year: "Year of the release's edition.",
			reference_month: "Month of the release's edition (1 to 12).",
			publisher:
				"Who published the boundaries, usually the ONS Open Geography Portal.",
			source_url: "Where the boundaries were downloaded from.",
			retrieved_at: "When they were downloaded.",
			licence: "Licence name as the publisher states it.",
			licence_url: "Licence URL.",
			deprecated:
				"1 if the atlas no longer recommends this release, else 0.",
			sunset: "Date after which a deprecated release may be removed.",
			replaced_by: "The release slug that replaces a deprecated one.",
			deprecation_reason: "Why a release is deprecated.",
		},
	},
	boundary_release_country: {
		audience: "reference",
		description:
			"The countries a boundary release covers, one row per country.",
		columns: {
			geography: "The geography slug.",
			release: "The release slug.",
			country:
				"A country it covers: England, Wales, Scotland or Northern Ireland.",
		},
	},
	boundary_release_source: {
		audience: "reference",
		description:
			"Links a boundary release to its source row, so its publisher and licence join like a dataset's.",
		columns: {
			geography: "The geography slug.",
			release: "The release slug.",
			source_id: "The source (source.id).",
		},
	},
	boundary_release_validity: {
		audience: "reference",
		description:
			"Evidence that a release was in force for a purpose on given dates, such as the constituencies used at a general election. Only verified entries are stored; a missing row is not a claim that a release was invalid.",
		columns: {
			geography: "The geography slug.",
			release: "The release slug.",
			purpose: "What the release was used for, such as election_poll.",
			valid_from: "First date the evidence covers (ISO date).",
			valid_to: "Last date the evidence covers (ISO date).",
			source_url: "The evidence.",
			note: "What the evidence does and does not show.",
		},
	},
	boundary_release_edition: {
		audience: "core",
		description:
			"View: which edition of each geography's boundaries was the latest held on a date. edition_from is the release's edition date and edition_until the next release's. This orders the snapshots the atlas holds; it is not the legal date the boundaries took effect.",
		columns: {
			geography: "The geography slug.",
			release: "The release slug.",
			edition_from: "Edition date of this release (ISO date).",
			edition_until:
				"Edition date of the next release, or null for the latest.",
		},
	},
	v_area_version: {
		audience: "core",
		description:
			"View: every area version with its code, geography and release spelled out. The easiest way to look up an area by code or name.",
		columns: {
			area_version_id: "area_version.id.",
			geography: "The geography slug.",
			release: "The release slug.",
			code: "The area code.",
			name: "The area's name in this release.",
			aliases: "JSON array of other names, or null.",
			area_m2: "Land area in square metres.",
			population: "Resident population, where held.",
			in_inventory: "1 if in the release's boundary file.",
			inventory_position: "Order in the boundary file.",
		},
	},
	v_area_current: {
		audience: "core",
		description:
			"View: each area at its latest version, one row per area. An area that has ended shows its last version, with the release it ended in. The easiest way to find what an area is called now, or to list the areas of a geography today.",
		columns: {
			area_version_id: "area_version.id of the latest version.",
			area_id: "area.id, the same across releases.",
			geography: "The geography slug.",
			release: "The latest release the area is in.",
			code: "The area code.",
			name: "The area's name on that release.",
			aliases: "JSON array of other names, or null.",
			area_m2: "Land area in square metres.",
			population: "Resident population, where held.",
			in_inventory: "1 if in the release's boundary file.",
			inventory_position: "Order in the boundary file.",
		},
	},
	source: {
		audience: "core",
		description:
			"A publisher of data, with its URL, licence text and how to cite it.",
		columns: {
			id: "Integer id.",
			publisher:
				"The publisher, such as 'Office for National Statistics'.",
			url: "The source's home page or download page.",
			licence:
				"Licence name as written by the publisher. licence and source_licence hold the normalised form.",
			licence_url: "Licence URL.",
			citation: "Attribution text to show with the data.",
		},
	},
	licence: {
		audience: "core",
		description:
			"A licence, with whether it allows commercial use and whether it requires derived work to be shared alike.",
		columns: {
			id: "Licence slug, such as ogl-3.0 or cc-by-sa-3.0.",
			name: "Full name.",
			url: "Licence text.",
			commercial_use:
				"1 if commercial use is allowed, 0 if not, null if unknown.",
			share_alike:
				"1 if derived work must use the same licence, 0 if not, null if unknown.",
			attribution:
				"The statement the licence asks users to print with the data, such as 'Contains public sector information licensed under the Open Government Licence v3.0'. v_series_terms.attribution joins these with the publishers.",
		},
	},
	source_licence: {
		audience: "core",
		description:
			"The licences a source's data is under. A source can have more than one.",
		columns: {
			source_id: "The source (source.id).",
			licence_id: "The licence (licence.id).",
		},
	},
	election_licence: {
		audience: "reference",
		description:
			"A licence that applies to one election's results in addition to its dataset's source, such as the CC BY-SA 2016 to 2019 local elections.",
		columns: {
			election_id: "The election (election.id).",
			licence_id: "The licence (licence.id).",
		},
	},
	v_source_terms: {
		audience: "core",
		description:
			"View: each source's licences and combined terms. commercial_use is 1 only if every licence allows it; share_alike is 1 if any licence requires it.",
		columns: {
			source_id: "source.id.",
			publisher: "The publisher.",
			url: "The source URL.",
			licences: "Comma-separated licence ids.",
			commercial_use: "1 if every licence allows commercial use.",
			share_alike: "1 if any licence requires share-alike.",
		},
	},
	v_election_terms: {
		audience: "reference",
		description:
			"View: each election's licence terms, including any licence specific to the election.",
		columns: {
			election_id: "election.id.",
			dataset: "Dataset slug.",
			label: "Election label.",
			date: "Polling day.",
			licence_id: "A licence that applies.",
			commercial_use: "1 if that licence allows commercial use.",
			share_alike: "1 if that licence requires share-alike.",
		},
	},
	dataset: {
		audience: "core",
		description:
			"A published dataset, such as crime or claimant-count: its title, description, source and topic module. Every series belongs to one dataset.",
		columns: {
			id: "Stable integer id.",
			slug: "Dataset name used across the atlas, such as general-election or house-price.",
			module: "Topic group: economy, education, environment, health, housing, infrastructure, politics, population, population-detail, society or transport.",
			title: "Human-readable title.",
			description: "What the dataset contains.",
			source_id: "Its publisher (source.id).",
			released: "When the publisher released this edition, where known.",
		},
	},
	unit: {
		audience: "core",
		description: "Reference units for measure values.",
		columns: {
			id: "Stable integer id.",
			slug: "Unique unit identifier.",
			label: "Published unit label.",
			kind: "Count, currency, percent, per_n, ratio, duration, index or other.",
			scale: "Denominator for percent and per_n; multiplier for count and currency units expressed in thousands or millions; otherwise 1.",
			currency: "ISO 4217 currency code when applicable, otherwise null.",
			symbol: "Display symbol when applicable, otherwise null.",
		},
	},
	universe: {
		audience: "core",
		description:
			"Population or entity base of a measure. Unknown and not applicable are explicit entries.",
		columns: {
			id: "Stable integer id.",
			slug: "Unique universe identifier.",
			label: "Description of the population or entity base.",
		},
	},
	measure: {
		audience: "core",
		description:
			"What is measured, in one unit: population, recorded-crimes, unemployment-rate. A measure is shared by every dataset that publishes it. Breakdowns such as age or crime type are dimensions, not separate measures.",
		columns: {
			id: "Stable integer id.",
			slug: "Measure name used across the atlas, such as recorded-crimes.",
			label: "Human-readable name.",
			description: "What the measure counts and over what population.",
			unit_id: "Reference to the value unit (unit.id).",
			statistic:
				"Statistic represented by the value. By-dimension means the statistic is selected by statistic_dimension_id.",
			statistic_dimension_id:
				"Dimension selecting the statistic, or null when statistic is fixed.",
			universe_id:
				"Population or entity base (universe.id), including explicit unknown or not applicable.",
			aggregation:
				"How values combine across areas: sum, ratio (rebuild from numerator and denominator), weighted_mean (average weighted by weight_id) or none (cannot be combined).",
			numerator_id: "For a ratio, the measure on top (measure.id).",
			denominator_id: "For a ratio, the measure underneath (measure.id).",
			weight_id:
				"For a weighted mean, the measure to weight by (measure.id).",
		},
	},
	dimension: {
		audience: "core",
		description:
			"A way a measure is broken down, such as sex, age, offence, tenure or party.",
		columns: {
			id: "Stable integer id.",
			slug: "Dimension name, such as offence.",
			label: "Human-readable name.",
		},
	},
	dimension_member: {
		audience: "core",
		description:
			"One value of a dimension, such as offence=burglary. Members can form a hierarchy through parent_id; the root is usually the total.",
		columns: {
			id: "Stable integer id.",
			dimension_id: "The dimension (dimension.id).",
			code: "Member code, such as burglary or total. Unique within a dimension.",
			label: "Human-readable name.",
			parent_id:
				"The member this one is part of (dimension_member.id), or null for a root.",
			position: "The publisher's display order.",
		},
	},
	period: {
		audience: "core",
		description:
			"A time period a value refers to. Each kind has one label format, but formats differ between kinds, so sort and compare by start_date and end_date.",
		columns: {
			id: "Stable integer id.",
			label: "The period's label, in the one format its kind uses: year 2024, financial_year 2024-25, academic_year 2024/25, quarter 2026-Q1, month 2026-03, range 2022-2024 (or year-ending-2026-03), date 2024-07-04.",
			kind: "year, financial_year, academic_year, quarter, month, date (one day, such as a polling day) or range.",
			start_date: "First day of the period (ISO date).",
			end_date: "Last day of the period (ISO date).",
		},
	},
	status: {
		audience: "core",
		description:
			"How a value should be read: observed, estimated, provisional, suppressed, not_applicable or derived.",
		columns: {
			id: "Integer id. 1 is observed.",
			slug: "observed (as published), estimated (modelled or split by a weight, may have bounds), provisional (may be revised), suppressed (withheld by the publisher, value is null), not_applicable, derived (computed exactly from other values).",
			label: "Human-readable name.",
		},
	},
	series: {
		audience: "core",
		description:
			"One dataset's values for one measure and one set of dimension members, on one boundary release. Published as released, converted onto another release, or modelled from several sources.",
		columns: {
			id: "Stable integer id.",
			dataset_id: "The dataset (dataset.id).",
			measure_id: "The measure (measure.id).",
			release_id:
				"The boundary release its areas are on (area_release.id).",
			method: "published (as the publisher released it), converted (moved onto release_id through crosswalks by the atlas) or modelled (estimated by the atlas from several sources, see series_model).",
			derived_from_id:
				"For a converted or modelled series, the published series it came from (series.id). series_input lists every input of a converted series, model_input those of a modelled one.",
			key: "Readable unique key: dataset/measure/geography:release/dimension=member..., with ~converted:geography:release appended for converted series and ~model:geography:release for modelled ones.",
		},
	},
	series_member: {
		audience: "core",
		description:
			"The dimension members that fix a series, one row per dimension. A series with no rows here has no breakdown.",
		columns: {
			series_id: "The series (series.id).",
			dimension_id: "The dimension (dimension.id).",
			member_id: "The member (dimension_member.id).",
		},
	},
	measure_dimension: {
		audience: "reference",
		description:
			"How each dimension is read for each measure that has series using it: a breakdown that splits a total, or a qualifier whose members are each their own quantity. The same dimension can have different roles for different measures (age is a breakdown of population and of claimants, sex a qualifier of life expectancy). Decided by a rule (a root member coded total or all that one of the measure's series holds) and by declarations in packages/measures/src/measurePreferences.ts, each with a reason. The build fails for a dimension that has neither.",
		columns: {
			measure_id: "The measure (measure.id).",
			dimension_id: "The dimension (dimension.id).",
			role: "breakdown: the members split a total and only the default is a quantity of its own. qualifier: every member is a different quantity.",
			default_member_id:
				"For a breakdown, the member that is the total (dimension_member.id). NULL for a qualifier, and for a breakdown whose total is the series that has no member of this dimension, as a population by age has no all-ages member but the whole population is the series with no age.",
		},
	},
	quantity: {
		audience: "reference",
		description:
			"A thing that has one value for each area and period: a measure on one boundary release with one member of each qualifier dimension. Each is held by one or more series, ranked in series_preference. A series is in a quantity only when it is at the default of every breakdown dimension, so quantities hold no parts of a total.",
		columns: {
			id: "Integer id, assigned in key order at each build, so it can change between builds. Use key to refer to a quantity.",
			measure_id: "The measure (measure.id).",
			release_id:
				"The boundary release (area_release.id) of the series it holds.",
			key: "Readable unique key: measure/geography:release, then /dimension=member for each qualifier member in name order, such as life-expectancy/localAuthority:2026-05-uk-bgc/sex=female.",
		},
	},
	series_preference: {
		audience: "reference",
		description:
			"The series that can answer a quantity, best first. Only series at the default of every breakdown dimension have a row. Order: published, aggregated, modelled (an open model before a ShareAlike one), converted, then the dataset order declared for the measure in packages/measures/src/measurePreferences.ts. Series that tie on all of these hold no area and period in common (the build fails otherwise) and are ranked by series id. v_observation_default reads it.",
		columns: {
			series_id: "The series (series.id).",
			quantity_id: "The quantity it can answer (quantity.id).",
			rank: "1 is preferred. Unique within a quantity. v_observation_default returns, for each area and period, the row of the lowest rank that has one.",
		},
	},
	series_coverage: {
		audience: "core",
		description:
			"How complete each series is in each period, so a reader can tell whether a measure is there before reading observations. One row for each (series, period) that has observations, about 9,000 rows in all, built at assembly from observation. Read it through v_coverage. The nation of an area is not stored for every area, so it is the ONS code prefix (E, W, S or N), else the one nation of a release that boundary_release_country says covers only one, else the ITL code letter (TLC to TLK England, TLL Wales, TLM Scotland, TLN Northern Ireland), else ?. Known missing values of a converted series are in series_gap and its quality in series_conversion.",
		columns: {
			series_id: "The series (series.id).",
			period_id: "The period (period.id).",
			areas: "Observation rows of the series in this period, one for each area.",
			areas_with_value:
				"Of those, the rows with a value or a category, not a suppressed or missing figure that has only a status. Never more than areas.",
			release_areas:
				"Area versions the series' release holds in its boundary file (area_version.in_inventory = 1). areas is never more than this, and the build fails if it is.",
			countries:
				"The nations with at least one value, as a sorted comma list of E, N, S and W, then ? for areas whose nation cannot be told (historical constituencies). Empty when the period has no value.",
		},
	},
	series_source: {
		audience: "reference",
		description:
			"Every source a series depends on, one row for each (series, source): its own dataset's source, the boundary file it is on, the sources of its crosswalks and their weights, and everything its inputs and its model read, however many steps away. Written at assembly so one lookup answers where a series comes from. Read it through v_series_attribution, which adds the publisher, licences and terms. Every series has at least one row, and every source of an input is also a row of the series built from it.",
		columns: {
			series_id: "The series (series.id).",
			source_id: "The source it depends on (source.id).",
			via: "How the closest path reaches the source, by the first step from the series: dataset (its own dataset's source), boundaries (the boundary file it is on, boundary_release_source), crosswalk (a crosswalk's provenance, crosswalk_provenance_source), crosswalk-weight (what a crosswalk's weights were counted from, crosswalk_weight_input), input:value or input:weight (an input series, series_input or derived_from_id, and everything it depends on), model (a dataset or set of weights a model names, dataset: and weights: in model_input) or model-input (a series a model's model_input names, and everything it depends on). On a tie in depth the first listed here wins.",
			vias: "Every way the source is reached, as a comma list in the order above, so a source that is both the dataset's and an input's reads 'dataset, input:value'.",
			depth: "Steps from the series to the source on the closest path: 0 for its own dataset's source, 1 for a boundary file, crosswalk or direct input, and more for what those depend on.",
		},
	},
	series_source_licence: {
		audience: "reference",
		description:
			"The licences a series holds a source under, one row for each (series, source, licence). Usually the source's own licences (source_licence). A source whose licence depends on the election, such as the local election archive (CC BY-SA 2016 to 2019, Open Parliament Licence 2021 to 2025), gives a series only the licences of the elections it holds (election_licence), or of the election a model read for the role date of its model_input row, so an open notional model does not carry CC BY-SA. A source with no row here has no licence on record and its terms are unknown.",
		columns: {
			series_id: "The series (series.id).",
			source_id: "The source (source.id).",
			licence_id: "The licence it is held under (licence.id).",
		},
	},
	series_notice: {
		audience: "reference",
		description:
			"The notices a series must print beyond its publishers and licence statements: the lines of a source's citation that begin 'Contains' (Royal Mail data) and 'Contains OS data © Crown copyright and database right <year>' for each Office for National Statistics boundary file the series is on or depends on, with the year of that file. A notice another one begins (the statement without its year) is left out.",
		columns: {
			series_id: "The series (series.id).",
			source_id:
				"The source the notice is about (source.id), which for an OS statement is the boundary file's source.",
			notice: "The text to print.",
		},
	},
	observation: {
		audience: "core",
		description:
			"One value: a series, an area version and a period. About 10.7 million rows. Primary key (series_id, area_version_id, period_id) with no other index, so always filter by series_id. v_observation is the readable form, and v_observation_default the one that gives a single value per quantity, area and period.",
		columns: {
			series_id: "The series (series.id).",
			area_version_id:
				"The area on the series' release (area_version.id).",
			period_id: "The period (period.id).",
			value: "The number, in the measure's unit. Null when suppressed or when the value is a category.",
			status_id: "How to read the value (status.id). 1 is observed.",
			lower: "Lower bound of a confidence interval or estimate, where published or computed. Null otherwise.",
			upper: "Upper bound, as lower.",
			category_id:
				"For a category measure (such as the winning party), the member it takes (dimension_member.id).",
		},
	},
	v_observation: {
		audience: "core",
		description:
			"View: every observation as a readable row with dataset, measure, members, area, release, period, value, status, method and licence. It holds every series, so a quantity held by several datasets, methods or breakdowns appears once for each: read v_observation_default for one value, and use this view to compare series or read a breakdown. Filter on measure and area_code (and geography or release) for fast reads.",
		columns: {
			dataset: "Dataset slug.",
			measure: "Measure slug.",
			unit: "Unit of value.",
			members:
				"Fixed dimension members as 'dimension=code; dimension=code', or null for no breakdown.",
			area_code: "Area code.",
			area_name:
				"Area name, as the dataset publishes it where that differs from the boundary file.",
			geography: "Geography slug.",
			release: "Boundary release slug.",
			period: "Period label.",
			value: "The value.",
			lower: "Lower bound, or null.",
			upper: "Upper bound, or null.",
			category: "Category member code for category measures, or null.",
			status: "Status slug.",
			method: "published, converted or modelled.",
			licence: "The source's licence as written.",
		},
	},
	v_observation_default: {
		audience: "core",
		description:
			"View: the safe way to read statistics. The columns of v_observation, for one row per quantity, area and period: the best series that has a row for it, where series_preference gives the order. A figure is never counted twice across datasets, methods or breakdowns, and the parts of a total (age bands, tenure types) are left out. A series is passed over only where it has no observation row, so a row with a NULL value (suppressed) is the answer. Read v_observation for every series and every breakdown. Filter on measure and area_code (and geography or release) for fast reads.",
		columns: {
			dataset: "Dataset slug.",
			measure: "Measure slug.",
			unit: "Unit of value.",
			members:
				"Fixed dimension members of the series as 'dimension=code; dimension=code', or null for no breakdown. A breakdown member here is the total, as tenure=total.",
			area_code: "Area code.",
			area_name:
				"Area name, as the dataset publishes it where that differs from the boundary file.",
			geography: "Geography slug.",
			release: "Boundary release slug.",
			period: "Period label.",
			value: "The value.",
			lower: "Lower bound, or null.",
			upper: "Upper bound, or null.",
			category: "Category member code for category measures, or null.",
			status: "Status slug.",
			method: "published, converted, aggregated or modelled.",
			licence: "The source's licence as written.",
			series_id: "The series the row came from (series.id).",
			quantity: "The quantity's key (quantity.key).",
			alternatives:
				"How many other series have a row for this quantity, area and period. 0 means no other series could have answered.",
		},
	},
	v_series_attribution: {
		audience: "core",
		description:
			"View: one row for each series and source it depends on, with the publisher, licences and terms of that source, so one query lists everything a series, however it was made, must credit. Filter by series_id or series (the key). A converted, aggregated or modelled series lists the sources of its inputs, crosswalks, crosswalk weights, boundary files and model inputs as well as its dataset's. commercial_use and share_alike are the source's own terms for this series; v_series_terms rolls them up. Read series_source for how the row was reached and series_source_licence for the election-aware licences.",
		columns: {
			series_id: "The series (series.id).",
			series: "The series key (series.key).",
			measure: "Measure slug.",
			method: "published, converted, aggregated or modelled.",
			source_id: "The source (source.id).",
			publisher: "Who publishes it.",
			url: "The publisher's page, or null.",
			citation:
				"The citation text recorded for the source, often empty. v_series_terms builds the text to print from publisher and licence instead.",
			licences:
				"The licences this series holds the source under, as a comma list of licence ids. Empty when none is on record.",
			commercial_use:
				"1 if every licence allows commercial use, 0 if any does not, null if the source has no licence on record.",
			share_alike:
				"1 if any licence requires derived work to be shared alike, 0 if none does, null if unknown.",
			via: "How the closest path reaches the source: dataset, boundaries, crosswalk, crosswalk-weight, input:value, input:weight, model or model-input. See series_source.",
			vias: "Every way it is reached, comma separated.",
			depth: "Steps from the series to the source on the closest path. 0 is its own dataset's source.",
		},
	},
	v_series_terms: {
		audience: "core",
		description:
			"View: one row for each series, with what it may be used for and the text to print. sources counts the sources behind it. commercial_use is the lowest over its sources and share_alike the highest, so a converted series built from a ShareAlike input is ShareAlike. Either is null when a source has no licence on record (unknown) and no other source settles it: a 0 for commercial_use or a 1 for share_alike is definite. attribution is ready to print: each publisher once, then each licence's statement once, then the OS and other notices the sources ask for, so a derived figure credits everything it is made from.",
		columns: {
			series_id: "The series (series.id).",
			series: "The series key (series.key).",
			measure: "Measure slug.",
			method: "published, converted, aggregated or modelled.",
			sources: "How many sources the series depends on.",
			licences:
				"Every licence the series is under, as a comma list of licence ids.",
			commercial_use:
				"1 if every source allows commercial use, 0 if any does not, null if unknown.",
			share_alike:
				"1 if any source requires derived work to be shared alike, 0 if none does, null if unknown.",
			attribution:
				"The statement to print with the figure, such as 'Source: Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2024.'",
		},
	},
	v_coverage: {
		audience: "core",
		description:
			"View: what exists and how complete it is, one row for each series and period, read before the observations. Filter on measure, geography, release and period (no joins). A row means observations exist: its share says for how many of the release's areas. share is low for a measure published only for the areas that polled (elections) or for one nation, and that is the data, not a fault. For a measure with no row on a release, v_coverage_missing says why it was not converted there. About 9,000 rows, so reading all of it takes milliseconds.",
		columns: {
			measure: "Measure slug.",
			quantity:
				"The quantity's key (quantity.key), or null for a series that is a part of a total (an age band, a tenure type), which is in no quantity.",
			members:
				"Fixed dimension members of the series as 'dimension=code; dimension=code', or null for no breakdown. Filter it to choose a statistic or a part: members LIKE '%pay-statistic=median%'.",
			dataset: "Dataset slug.",
			geography: "Geography slug.",
			release: "Boundary release slug of the series.",
			period: "Period label.",
			period_kind:
				"year, financial_year, academic_year, quarter, month, date or range.",
			period_start: "First day of the period, as YYYY-MM-DD.",
			period_end: "Last day of the period, as YYYY-MM-DD.",
			method: "published, converted, aggregated or modelled.",
			is_default:
				"1 if this series is rank 1 of its quantity in series_preference, so v_observation_default prefers it. It can still lose to another series for an area it has no row for. 0 for the others and for a part of a total.",
			preference_rank:
				"Its rank in series_preference (1 is best), or null for a part of a total.",
			areas: "Areas with an observation row.",
			areas_with_value: "Of those, areas with a value or a category.",
			release_areas: "Areas the release holds.",
			share: "areas_with_value divided by release_areas, 0 to 1, rounded to four places. Null if the release holds no areas.",
			countries:
				"Nations with at least one value: a sorted list of E, N, S and W, then ? where the nation cannot be told. See series_coverage.",
			exact_share:
				"Converted series only: the share of values not apportioned by a weight (series_conversion.exact_share). Null for any other method.",
			coverage:
				"Converted series only: the share of target areas and periods reached that hold a value (series_conversion.coverage). Null for any other method.",
			series_id: "The series (series.id).",
		},
	},
	v_coverage_missing: {
		audience: "core",
		description:
			"View: why a measure is not on a release. It lists the measure, geography and release combinations the conversion planner considered and left with no series, with the reason from conversion_skip, so a question about availability gets a coverage row or a reason, never silence. It is not every measure on every release: a combination the planner never considered, such as a measure with no published series to convert, is in neither this view nor v_coverage. A combination appears once for each dataset, source release and reason. A skip where the measure does have a series on the release (from another dataset, or by a better route) is left out.",
		columns: {
			measure: "Measure slug.",
			geography:
				"Geography slug of the release the measure is missing from.",
			release: "Boundary release slug it is missing from.",
			reason: "refused-measure (measure_conversion says refuse), no-route (no crosswalk path), no-values (every value would be a split and splitting is refused), missing-component (a ratio lacks its numerator, denominator or weight), better-route (a better source kept its place) or published-on-target (already published there for every period it holds).",
			explanation:
				"The reason in words. For refused-measure it is measure_conversion.reason, which says why the measure cannot be converted.",
			dataset: "The dataset whose series was not converted.",
			source_geography:
				"Geography slug of the release it is published on.",
			source_release: "Boundary release slug it is published on.",
			source_series: "Number of published series affected.",
		},
	},
	v_series: {
		audience: "core",
		description:
			"View: every series with its dataset, measure, fixed members, boundary release and method spelled out. Use it to see what a dataset holds before reading v_observation, and to find the series a converted one came from.",
		columns: {
			series_id: "series.id.",
			key: "The series' stable text key.",
			dataset: "Dataset slug.",
			measure: "Measure slug.",
			unit: "Unit of the measure.",
			members:
				"Fixed dimension members as 'dimension=code; dimension=code', or null for no breakdown.",
			geography: "Geography slug.",
			release: "Boundary release slug the series is published on.",
			method: "published, converted, aggregated or modelled.",
			derived_from:
				"The key of the series this one was derived from, or null for a published series.",
		},
	},
	dataset_area_name: {
		audience: "reference",
		description:
			"An area's name as a dataset publishes it, stored only where it differs from the boundary file's name.",
		columns: {
			dataset_id: "The dataset (dataset.id).",
			area_version_id: "The area (area_version.id).",
			name: "The published name.",
		},
	},
	area_identifier: {
		audience: "reference",
		description:
			"A published external identifier for an area, such as the NHS ODS code of an NHS board. Join other data that is keyed by the identifier to the area's statistics through area_version_id.",
		columns: {
			dataset_id: "The dataset (dataset.id) that carries the identifier.",
			area_version_id: "The area (area_version.id).",
			scheme: "The identifier scheme, such as nhs-ods for NHS Organisation Data Service codes.",
			identifier: "The area's identifier in the scheme, such as QYG.",
		},
	},
	dataset_area_key: {
		audience: "internal",
		description:
			"A dataset's own record key for an area, where the website needs it, such as an election slug. Not needed for analysis. Published external codes are also in area_identifier.",
		columns: {
			dataset_id: "The dataset (dataset.id).",
			area_version_id: "The area (area_version.id).",
			key: "The dataset's key.",
		},
	},
	dataset_coverage_gap: {
		audience: "reference",
		description:
			"Areas a dataset leaves out or cannot place, with the reason, such as wards excluded from a local election or small areas missing a count.",
		columns: {
			dataset_id: "The dataset (dataset.id).",
			edition: "The dataset edition or year affected.",
			kind: "What is missing: election-ward (a ward left out of a local election), collision-area (an area code that road collisions were dropped from, such as the Heathrow code) or collision-without-lsoa (road collisions that name no LSOA, by nation).",
			position: "Order within the edition and kind.",
			area_code: "The area's code.",
			area_name: "The area's name.",
			parent_name: "The area's parent, such as its council, for context.",
			reason: "Why it is missing, as a slug such as code-shared-by-wards.",
			count: "How many records the gap covers, where counted.",
		},
	},
	area_hierarchy: {
		audience: "core",
		description:
			"Direct child to parent assignments from membership and best-fit crosswalks. Join area_version and area_release for geography and release, and crosswalk for provenance. Several sources or vintages can give different parents.",
		columns: {
			child_version_id: "The child area version (area_version.id).",
			parent_version_id:
				"The assigned parent area version (area_version.id).",
			crosswalk_id:
				"The crosswalk providing the assignment (crosswalk.id).",
			accuracy:
				"exact for published clean containment; approximate for best fit, geometry-derived containment with sliver tolerance, and official membership lookups whose containment has not been verified.",
		},
	},
	area_relationship: {
		audience: "core",
		description:
			"A publisher's statement about how two areas relate, for a period: parent (contains it), predecessor (it was formed from), published-as (listed under that code) or coterminous (same extent). Answers 'what replaced Allerdale?' and 'which county is this district in?' as the publisher saw it.",
		columns: {
			dataset_id:
				"The dataset whose publisher makes the statement (dataset.id).",
			relation: "parent, predecessor, published-as or coterminous.",
			period_id: "The period the statement is for (period.id).",
			child_version_id:
				"The area the statement is about (area_version.id).",
			parent_version_id:
				"The related area: its parent, its predecessor, the code it was published as, or its coterminous area (area_version.id).",
		},
	},
	series_input: {
		audience: "reference",
		description:
			"For a converted series, every series it was computed from and the role each played. A population total converted onto an older or newer release names each single year of age it adds up, all as value, and holds the members they share (sex=all).",
		columns: {
			series_id: "The converted series (series.id).",
			input_series_id: "An input (series.id).",
			role: "value (the series being moved), numerator, denominator or weight.",
		},
	},
	series_crosswalk: {
		audience: "reference",
		description:
			"The crosswalks a converted series was moved through, in order.",
		columns: {
			series_id: "The converted series (series.id).",
			position: "Step number, from 0.",
			crosswalk_id: "The crosswalk used (crosswalk.id).",
			reversed:
				"1 if the crosswalk was used from its to side to its from side.",
		},
	},
	series_conversion: {
		audience: "core",
		description: "How a converted series was made and how far to trust it.",
		columns: {
			series_id: "The converted series (series.id).",
			rule: "sum (parts added) or rebuild (a ratio or weighted mean recomputed from converted parts).",
			basis_id: "The weight basis used to split areas (weight_basis.id).",
			exact: "1 if every value came from regrouping whole areas with no estimated split.",
			exact_share:
				"Share of the series' values (0 to 1) not apportioned by a weight. 1 means fully exact.",
			coverage:
				"Share of target areas and periods reached that hold a value (0 to 1).",
			note: "Anything else a reader should know.",
		},
	},
	series_estimate: {
		audience: "reference",
		description:
			"Each estimated value of a converted series, with how much of it was apportioned by a weight. A value with no row was regrouped exactly.",
		columns: {
			series_id: "The converted series (series.id).",
			area_version_id: "The area (area_version.id).",
			period_id: "The period (period.id).",
			estimated_share:
				"Share of the value (0 to 1) that took a split or a pruned pair. 1 minus it is the share regrouped from whole source areas.",
		},
	},
	series_gap: {
		audience: "reference",
		description:
			"Each area and period of a converted series that has no value, and why.",
		columns: {
			series_id: "The converted series (series.id).",
			area_version_id: "The area with no value (area_version.id).",
			period_id: "The period (period.id).",
			reason: "missing-input (a source area had no observed value), no-weight (the crosswalk has no weight on the basis), unmeasured-split (the value would be split in a way the backtest has not measured for this measure), not-carried (no crosswalk on the route reaches this area), no-denominator (a rebuilt ratio's denominator is not above zero), better-route (a better source holds this area and period for the same measure and members, so this series' own value was dropped).",
		},
	},
	model: {
		audience: "reference",
		description:
			"Each model the atlas estimates modelled series with, such as a notional election on new boundaries.",
		columns: {
			id: "Model slug, also the suffix of its series' keys.",
			label: "What the model estimates.",
			licence_id:
				"The share-alike licence an input is under, which the model's values carry too, or null when none is.",
			bound_factor:
				"The factor the bounds of its estimated values are drawn with: a value's lower and upper are the value less and plus this times the votes it moved between areas by estimate.",
			about: "How the model works, in brief.",
		},
	},
	model_input: {
		audience: "reference",
		description:
			"What each model read, by role. Every key resolves to sources: it is a series key, or a reference to a dataset or a weight basis, which v_series_attribution follows.",
		columns: {
			model_id: "The model (model.id).",
			role: "What the input is for, such as 'general election' or 'local election 2019-05-02'.",
			key: "A series.key, or a reference: 'dataset:<dataset.slug>' for a dataset read directly (such as the 2017 Scottish results file, which the local election series leave out) or 'weights:<weight_basis.id>' for the weights a model placed votes with. A reference may end in ' (detail)', such as the file read. A role starting 'local election ' ends in the polling day, which decides which election licence the input is under.",
		},
	},
	series_model: {
		audience: "reference",
		description: "The model each modelled series is from.",
		columns: {
			series_id: "The modelled series (series.id).",
			model_id: "The model (model.id).",
		},
	},
	measure_conversion: {
		audience: "core",
		description:
			"Whether each measure can be moved onto other boundaries, and if not, why.",
		columns: {
			measure_id: "The measure (measure.id).",
			rule: "sum, rebuild or refuse.",
			split_basis_id:
				"The weight basis used when an area must be split (weight_basis.id).",
			reason: "Why the rule applies, and for refuse what is missing.",
		},
	},
	conversion_skip: {
		audience: "reference",
		description:
			"Published series that were not converted onto a standard release, with the reason.",
		columns: {
			dataset_id: "The dataset (dataset.id).",
			measure_id: "The measure (measure.id).",
			source_release_id:
				"The release it is published on (area_release.id).",
			target_release_id:
				"The standard release it was not moved to (area_release.id).",
			reason: "refused-measure (measure_conversion says refuse), no-route (no crosswalk path), no-values (every value would be split and splitting is refused), published-on-target (already published there for every period it holds; a source with other periods is converted for those alone), missing-component (a ratio lacks its numerator, denominator or weight), better-route (every value it would give for a target area and period came from a better source, kept in its place).",
			series: "Number of published series affected.",
		},
	},
	conversion_backtest: {
		audience: "reference",
		description:
			"Accuracy tests of conversion: a known figure moved through crosswalks and compared with the truth. See docs/conversion-accuracy.md.",
		columns: {
			case_id: "The test case.",
			basis_id: "Weight basis tested.",
			value_class:
				"regrouped (whole areas) or split (apportioned) values.",
			title: "What the case tests.",
			kind: "What the case measures: noise (an exact regrouping, so any difference is the publisher's disclosure control), regroup (no split), split (one estimated hop) or chain (several estimated hops).",
			family: "Measure family tested, such as population.",
			series: "Series compared.",
			periods: "Periods compared.",
			compared: "Number of values compared.",
			exact: "Number that matched exactly.",
			median_relative: "Median relative error.",
			p95_relative: "95th percentile relative error.",
			max_relative: "Largest relative error.",
			mean_absolute: "Mean absolute error, in the measure's unit.",
			max_absolute: "Largest absolute error.",
			median_per_risk:
				"Median of the absolute error divided by the part of the value that a split moved (the value at risk). Null for regrouped values.",
			p95_per_risk:
				"95th percentile of the absolute error divided by the value at risk. Null for regrouped values.",
			max_per_risk:
				"Largest absolute error divided by the value at risk. Null for regrouped values.",
		},
	},
	conversion_backtest_gap: {
		audience: "internal",
		description: "Backtest areas that could not be compared, and why.",
		columns: {},
	},
	conversion_backtest_worst: {
		audience: "internal",
		description:
			"The worst individual errors in each backtest, for inspection.",
		columns: {},
	},
	conversion_error: {
		audience: "internal",
		description:
			"Error factors per crosswalk method and weight basis, used to set the bounds of estimated values.",
		columns: {},
	},
	conversion_error_check: {
		audience: "internal",
		description:
			"Held-out checks that the error factors in conversion_error cover the observed errors.",
		columns: {},
	},
	crosswalk: {
		audience: "core",
		description:
			"A mapping from the areas of one boundary release to the areas of another, such as LSOA 2021 to local authority 2023, or ward 2022 to constituency 2024.",
		columns: {
			id: "Stable integer id.",
			slug: "Readable name: from-geography-release-to-geography-release-method.",
			inventory_position: "Build order. Not stable between builds.",
			from_release_id: "Release of the source areas (area_release.id).",
			to_release_id: "Release of the target areas (area_release.id).",
			method: "official-lookup or clean-containment (from the publisher), best-fit (each source to one target), extent-continuity (same area across releases), geometric-containment, area-overlap, population-overlap or postcode-overlap (split by measured overlap).",
			quality: "publisher-supplied or derived.",
			purpose:
				"identity (same areas across releases), membership (small areas inside larger ones), or null for general mappings.",
			weighting: "JSON description of how weights were computed, if any.",
			basis_id:
				"The crosswalk's main weight basis (weight_basis.id), or null.",
			provenance:
				"JSON: sources and inputs the crosswalk was built from.",
			validation: "JSON: checks run on the crosswalk and their results.",
		},
	},
	crosswalk_edge: {
		audience: "core",
		description:
			"One link between a source area and a target area in a crosswalk.",
		columns: {
			crosswalk_id: "The crosswalk (crosswalk.id).",
			from_version_id: "Source area (area_version.id).",
			to_version_id: "Target area (area_version.id).",
			relation:
				"For best-fit crosswalks: within (source wholly inside target), straddles (source crosses targets, assigned to the best one) or indeterminate. Null otherwise.",
			change: "For official lookups between releases: unchanged, split, merged or complex. Null otherwise.",
		},
	},
	weight_basis: {
		audience: "core",
		description:
			"What a crosswalk weight measures: area, population (residents), households, dwellings or postcodes.",
		columns: {
			id: "Basis slug.",
			label: "What is counted in the overlap.",
		},
	},
	crosswalk_weight: {
		audience: "core",
		description:
			"The weight of a crosswalk edge on one basis, stored where an area is split. v_crosswalk_weight adds the implicit weight of 1 for edges that move a whole area.",
		columns: {
			crosswalk_id: "The crosswalk (crosswalk.id).",
			from_version_id: "Source area (area_version.id).",
			to_version_id: "Target area (area_version.id).",
			basis_id: "The basis (weight_basis.id).",
			weight: "Share of the source, on this basis, that falls in the target. Sums to 1 over a source's targets. Null if not measured, which is not zero.",
			overlap:
				"The amount in the overlap, in the basis's unit (square metres, residents, households, dwellings or postcodes).",
			source_share: "Share of the source area in the overlap.",
			target_share: "Share of the target area in the overlap.",
		},
	},
	v_crosswalk_chain_edge: {
		audience: "core",
		description:
			"View: old code to current code in one join. One row for each old area, current area and basis, with the weight along the whole chain and its error. Filter on geography, from_release, to_release (the current release) and basis, then join on code. A chain stored for every basis is returned once for each of the four. Use it to move a count from any old release to the current one: SUM(value * weight) grouped by to_code, keeping the groups where every contributing edge has complete = 1.",
		columns: {
			geography: "Geography slug.",
			from_release: "The old release.",
			to_release: "The geography's current release.",
			basis: "Weight basis: population, households, dwellings or postcodes.",
			from_code: "Old area code.",
			from_name: "Old area name.",
			to_code: "Current area code.",
			to_name: "Current area name.",
			weight: "Share of the old area's value that arrives on the current area.",
			weight_lower:
				"Lower likely bound of the weight. Null only where some of the value is at risk and the error factor is not measured.",
			weight_upper:
				"Upper likely bound of the weight. Null only where some of the value is at risk and the error factor is not measured.",
			at_risk: "Share of the value that passed through a split.",
			pruned: "Share carried whole from an area partly put elsewhere.",
			estimated_share: "Share of the weight carried by a non-exact edge.",
			complete:
				"1 where every old area feeding the current area has a route to it. 0 where one has none, so the current area's value may be understated.",
			hops: "Crosswalks in the route.",
			exact: "1 if no step of the route splits a value.",
			chain_id: "crosswalk_chain.id.",
			from_version_id: "Old area_version.id.",
			to_version_id: "Current area_version.id.",
		},
	},
	v_crosswalk_chain_gap: {
		audience: "core",
		description:
			"View: the old areas that lose value on the way to the current release, one row for each area and basis. Includes the areas in no crosswalk of a step, which have no edge in v_crosswalk_chain_edge and are not stored. Filter on geography, from_release and basis. Use it to say which old codes cannot be carried to the current release, or only partly.",
		columns: {
			geography: "Geography slug.",
			from_release: "The old release.",
			to_release: "The geography's current release.",
			basis: "Weight basis: population, households, dwellings or postcodes.",
			from_code: "Old area code.",
			from_name: "Old area name.",
			reason: "Why the value stops, as crosswalk_chain_gap.reason. not-in-crosswalk where nothing is stored.",
			has_edge:
				"1 if some of the area's value does arrive, so its edges sum to less than 1. 0 if none does.",
			chain_id: "crosswalk_chain.id.",
			from_version_id: "Old area_version.id.",
		},
	},
	v_crosswalk_edge: {
		audience: "core",
		description:
			"View: every crosswalk edge with codes, names and its weight.",
		columns: {
			crosswalk: "Crosswalk slug.",
			from_code: "Source area code.",
			from_name: "Source area name.",
			to_code: "Target area code.",
			to_name: "Target area name.",
			relation: "As crosswalk_edge.relation.",
			change: "As crosswalk_edge.change.",
			basis: "Weight basis, if weighted.",
			weight: "Weight on that basis.",
			overlap: "Amount in the overlap.",
			source_share: "Share of the source in the overlap.",
			target_share: "Share of the target in the overlap.",
		},
	},
	v_crosswalk_weight: {
		audience: "core",
		description:
			"View: every usable crosswalk weight, stored or implied. Use this, not crosswalk_weight, to convert values.",
		columns: {
			crosswalk: "Crosswalk slug.",
			from_code: "Source area code.",
			to_code: "Target area code.",
			basis: "Weight basis.",
			weight: "Share of the source in the target, on this basis.",
			overlap: "Amount in the overlap, null for implied weights.",
			source_share: "Share of the source in the overlap.",
			target_share: "Share of the target in the overlap.",
			derivation:
				"stored (measured), exact (the whole source goes to this target) or single-target (the source has one target).",
			crosswalk_id: "crosswalk.id.",
			from_version_id: "Source area_version.id.",
			to_version_id: "Target area_version.id.",
		},
	},
	crosswalk_chain: {
		audience: "core",
		description:
			"Old code to current code in one step. One row for each old release of a geography and each weight basis (or one for every basis, where the chain is the same on all four), joining it to the geography's current release (the lowest area_release.inventory_position) by the route the converter would take. The route's crosswalks are collapsed into crosswalk_chain_edge, one edge from each old area to each current area its value can reach, so a value moves across any number of boundary changes in one join. Read it through v_crosswalk_chain_edge. Weights and error are the converter's own arithmetic, so a value carried by a chain and the same value converted through the crosswalks agree. A geography release with no route to the current one has no row.",
		columns: {
			id: "Stable id. Its natural key is (geography, from release, to release, basis), with basis any where basis_id is null.",
			from_release_id: "The old release (area_release.id).",
			to_release_id:
				"The current release of the same geography (area_release.id).",
			basis_id:
				"The weight basis (weight_basis.id): population, households, dwellings or postcodes. Null where the chain is identical on all four, as an exact regrouping is, and then it stands for each of them.",
			hops: "Crosswalks the route joins, counting every crosswalk of a step that has several.",
			exact: "1 if no step of the route can split a value, so every weight is 1.",
			edges: "Rows of crosswalk_chain_edge for the chain.",
			gaps: "Old areas of the chain that lose part or all of their value, as v_crosswalk_chain_gap lists them.",
		},
	},
	crosswalk_chain_hop: {
		audience: "reference",
		description:
			"The crosswalks a chain was composed from, in route order. A step with several crosswalks between the same two releases lists each at one position. The first crosswalk at a position that has an edge for an area carries it, best method first.",
		columns: {
			chain_id: "The chain (crosswalk_chain.id).",
			position: "1 for the first step from the old release.",
			crosswalk_id: "The crosswalk (crosswalk.id).",
			reversed:
				"1 where the crosswalk is walked from its targets to its sources, which only an extent-continuity crosswalk can be.",
		},
	},
	crosswalk_chain_edge: {
		audience: "core",
		description:
			"One edge from an area of the old release to an area of the current release, with the weight and the error accumulated along the chain. Use v_crosswalk_chain_edge, which adds codes and names and reads a chain stored for every basis once for each. To move a count, multiply it by weight and sum for each current area, using only current areas whose complete is 1 as whole.",
		columns: {
			chain_id: "The chain (crosswalk_chain.id).",
			from_version_id: "The old area (area_version.id).",
			to_version_id: "The current area (area_version.id).",
			weight: "The share of a value on the old area that arrives on the current area, the product of the weights along the route summed over its paths.",
			at_risk:
				"The share of the value that passed through a split, so may be in the wrong area. 0 for an exact regrouping.",
			pruned: "The share carried whole from an area that a crosswalk's pruned pairs put partly elsewhere. The value is too high by about this much.",
			estimated_share:
				"The share of the edge's weight carried by an edge that is not an exact regrouping, from 0 to 1. 1 minus it is the share regrouped exactly.",
			weight_lower:
				"The lowest the weight is likely to be: weight less the backtest's error factor times at_risk, less pruned, never below 0. With nothing at risk the factor does not matter, so the bound is weight less pruned and is never null. Null only where at_risk is above 0 and the factor is not measured for the splitting method and basis.",
			weight_upper:
				"The highest the weight is likely to be: weight plus the error factor times at_risk. With nothing at risk it is the weight itself and is never null. Null only where at_risk is above 0 and the factor is not measured.",
			complete:
				"1 where every old area feeding the current area, at every step, has a route to it, so a value set on every old area arrives whole. 0 where a feeding old area has no route to it (it is in no crosswalk of a step, or its value was blocked), so the value summed on the current area may be understated. The weights themselves are not changed by it. Read it as the minimum over the rows of one current area.",
		},
	},
	crosswalk_chain_gap: {
		audience: "reference",
		description:
			"Old areas that lose part of their value on the way to the current release, or lose it for a named reason. An inventory area of the old release with no edge in the chain and no row here is in no crosswalk of a step it reaches (not-in-crosswalk), and nothing arrives; most areas that lose value are of this kind, so they are not stored (about 213,000 rows that the inventory and the chain already imply). Read every gap through v_crosswalk_chain_gap, which adds them.",
		columns: {
			chain_id: "The chain (crosswalk_chain.id).",
			from_version_id: "The old area (area_version.id).",
			reason: "Why a branch of the area's value stops: no-weight (a split with no measured weight on the basis), best-fit-straddler, ambiguous-membership, weights-do-not-sum (all as for crosswalk steps), missing-input, or not-in-crosswalk (the area is in no crosswalk of a step it reaches, and some of its value did arrive).",
		},
	},
	crosswalk_edge_check: {
		audience: "reference",
		description:
			"Geometric checks on crosswalk edges used to rebuild API responses. Kept in the serving atlas.sqlite and available separately in the crosswalk-checks module.",
		columns: {
			crosswalk_id: "The crosswalk (crosswalk.id).",
			from_version_id: "Source area.",
			to_version_id: "Target area.",
			contained_share: "Share of the source's area inside the target.",
			outside_width_m:
				"Width in metres of the part of the source outside the target.",
			match: "How the two boundaries compare, such as identical or recoded.",
			widest_difference_m:
				"Largest gap in metres between the two boundaries.",
			claimed_difference_m:
				"Width in metres of the widest piece of the difference between the two boundaries that another area claims. Set only when the difference is wide enough to need judging, and left null otherwise.",
			check_source_share: "Unweighted source share, for checking.",
			check_target_share: "Unweighted target share, for checking.",
			overlap_area_m2:
				"Overlap in square metres, on population-weighted crosswalks.",
		},
	},
	crosswalk_source: {
		audience: "reference",
		description:
			"Source areas of a crosswalk that are only partly covered, or have no target at all.",
		columns: {
			crosswalk_id: "The crosswalk (crosswalk.id).",
			from_version_id: "The source area (area_version.id).",
			coverage:
				"Share of the source that has a target (0 to 1). 0 means no target.",
		},
	},
	area_change_event: {
		audience: "core",
		description:
			"One change to the areas of a geography between two of its boundary releases: a rename, a new code, a redrawn extent, a split, a merge, a redistribution, an area that ended or an area that was created. Areas that did not change have no event. The areas involved are in area_change_member. effective_date is the legal date of the change from the ONS Code History Database where the event could be matched to it (date_basis 'legal'), and otherwise the later release's edition date (date_basis 'edition'). edition_date always holds the edition date, so the two can be compared.",
		columns: {
			id: "Event number. Events are numbered in order of geography, earlier release, later release, then the smallest code on each side, so a rebuild from the same data gives the same ids.",
			geography_id: "The geography (geography.id).",
			from_release_id: "The earlier boundary release (area_release.id).",
			to_release_id: "The later boundary release (area_release.id).",
			kind: "renamed (same code, new name), recoded (one area, new code), redrawn (same code, but the extent moved and the extent-continuity crosswalk measured it), split (one area became several), merged (several became one), redistributed (several became several, in one tangle of overlaps), ended (no area continues it) or created (no earlier area).",
			realigned:
				"1 when the event rests on a successor an extent-continuity crosswalk lists as realigned: the extent moved by a street but each area kept nearly all of the other, so the later area is the earlier one's successor and not a new area. 0 otherwise. A redrawn event with realigned 0 is an area whose extent moved too far to be called its own successor. A split, merge or redistribution from an official lookup has realigned 1 when one of its areas is also such a successor.",
			effective_date:
				"When the change took effect (ISO date). The legal date from the ONS Code History Database where date_basis is 'legal'; otherwise the later release's edition date, by which the change had happened. A legal date is the day the change was in force (typically 1 April, 1 May or another operative date), so it is usually before edition_date, by up to several years for a change an edition held late. It can fall up to 30 days after edition_date, because an edition date is the first day of its month and the change may have happened later in that month.",
			date_basis:
				"What effective_date means. 'legal': the operative date in the ONS Code History Database, taken from a predecessor and successor pair the event links or, for a created or ended area, from the day its code came into or went out of use, and only when it lies between the earlier release's edition date and the end of the later release's edition month. 'edition': no such date was found (renamed and redrawn events never have one, nor do areas the database does not cover such as ITL areas), so effective_date is the later release's edition date and is not the legal date of the change. Where an event has several candidate dates the earliest in that interval is used.",
			edition_date:
				"The later release's edition date (ISO date, boundary_release_edition.edition_from). The change had happened by this edition. The same as effective_date when date_basis is 'edition'.",
			source: "What the event is evidenced by: 'crosswalk' (an identity crosswalk) or 'publisher' (a predecessor statement in area_relationship or a documented edition replacement).",
			basis: "How the change was found, which says how far to trust a split or merge. 'official-lookup': a publisher's lookup between the two releases (the local authority and LSOA lookups, and the ONS Code History Database for wards and constituencies), so a split or merge is a recorded one. 'extent-continuity': an extent-continuity crosswalk, which links only areas whose extent held, so a split or merge cannot appear and a missing one is not evidence there was none. 'clean-containment': an identity crosswalk built from containment of extents. 'publisher-statement': a predecessor statement in area_relationship or a documented edition replacement. An official lookup pair that an extent-continuity crosswalk also covers keeps basis 'official-lookup' and takes the continuity crosswalk's redrawn and realigned findings.",
			crosswalk_id:
				"The identity crosswalk the event was read from (crosswalk.id). Null when source is 'publisher'.",
		},
	},
	area_change_member: {
		audience: "core",
		description:
			"The areas in a change event: the earlier areas on the 'from' side and the later areas on the 'to' side. An ended area has only a from member and a created area only a to member.",
		columns: {
			event_id: "The event (area_change_event.id).",
			side: "'from' for an area in the earlier release, 'to' for an area in the later release.",
			area_version_id: "The area in that release (area_version.id).",
			share: "The share of the earlier area's residents on this member's link to the other side (0 to 1), from the population weight of the crosswalk. Null when the member has more than one link in the event, or the crosswalk holds no population weight, which is the case for all extent-continuity crosswalks.",
		},
	},
	v_area_change: {
		audience: "core",
		description:
			"View: one row per area in each change event, with the event's geography, kind, dates and releases and the area's side, code and name. Pick the events that involve an area with a subquery on event_id.",
		columns: {
			event_id: "The event (area_change_event.id).",
			geography: "The geography slug.",
			kind: "As area_change_event.kind.",
			realigned: "As area_change_event.realigned.",
			effective_date: "As area_change_event.effective_date.",
			date_basis: "As area_change_event.date_basis.",
			edition_date: "As area_change_event.edition_date.",
			source: "As area_change_event.source.",
			basis: "As area_change_event.basis.",
			from_release: "Slug of the earlier boundary release.",
			to_release: "Slug of the later boundary release.",
			side: "'from' for the earlier release, 'to' for the later.",
			code: "Area code.",
			name: "Area name in that release.",
			share: "As area_change_member.share.",
			area_version_id: "The area in that release (area_version.id).",
		},
	},
	crosswalk_weight_input: {
		audience: "reference",
		description:
			"The raw input files a crosswalk's weights on a basis were computed from.",
		columns: {
			crosswalk_id: "The crosswalk (crosswalk.id).",
			basis_id: "The basis (weight_basis.id).",
			input: "Path of the input file within the raw data release.",
		},
	},
	crosswalk_weight_boundary_source: {
		audience: "reference",
		description:
			"The boundary sources used on each side of a crosswalk when computing weights.",
		columns: {
			crosswalk_id: "The crosswalk.",
			basis_id: "The basis.",
			side: "from or to.",
			source_id: "The boundary source (source.id).",
		},
	},
	crosswalk_count_source: {
		audience: "reference",
		description:
			"The count files (such as census population) a crosswalk's weights were built from.",
		columns: {
			crosswalk_id: "The crosswalk.",
			input: "Path of the input file within the raw data release.",
		},
	},
	crosswalk_input_source: {
		audience: "reference",
		description:
			"The source (and so the licence) of each crosswalk input file.",
		columns: {
			input: "Path of the input file.",
			source_id: "Its source (source.id).",
		},
	},
	crosswalk_provenance_source: {
		audience: "reference",
		description: "The sources a crosswalk was built from, for attribution.",
		columns: {
			crosswalk_id: "The crosswalk.",
			source_id: "A source (source.id).",
			input: "The input file from that source.",
		},
	},
	election: {
		audience: "core",
		description:
			"An election held in a dataset: general or local, with its polling day and the boundary release its areas are on.",
		columns: {
			id: "Integer id.",
			dataset_id: "The dataset (dataset.id).",
			label: "The publisher's label, such as 2024 or 1974O (October 1974).",
			kind: "general or local.",
			date: "Polling day (ISO date).",
			release_id: "The boundary release of its areas (area_release.id).",
		},
	},
	party: {
		audience: "core",
		description: "A political party, once however it is written.",
		columns: {
			id: "Integer id.",
			code: "The publisher's abbreviation, such as Lab.",
			key: "The atlas's key, the abbreviation in upper case, such as LAB.",
			name: "Full name.",
			colour: "Display colour as hex, where known.",
		},
	},
	contest: {
		audience: "core",
		description:
			"One area's contest at one election: the winner, the two leading parties and the publisher's text. Votes are observations (measure party-votes).",
		columns: {
			id: "Integer id.",
			election_id: "The election (election.id).",
			area_version_id:
				"The constituency, ward or division (area_version.id).",
			area_name: "The area name as published.",
			authority_code: "The council the area is in, for local elections.",
			authority_name: "The council's name.",
			constituency_type: "Borough or County, for constituencies.",
			result: "The publisher's result text, such as 'Lab gain from Con'.",
			region_text: "Region as published, where it is not a held area.",
			country_text: "Country as published, where it is not a held area.",
			region_area_version_id:
				"The region as an area (area_version.id), where it matches one.",
			country_area_version_id:
				"The country as an area (area_version.id), where it matches one.",
			first_party_id: "Party with most votes (party.id).",
			second_party_id: "Party with second most votes (party.id).",
			winner_party_id: "Party declared the winner (party.id).",
		},
	},
	candidacy: {
		audience: "core",
		description:
			"A candidate the contest elected. Party votes and share are in v_candidacy.",
		columns: {
			contest_id: "The contest (contest.id).",
			position: "Order within the contest.",
			given_name: "Given name.",
			family_name: "Family name.",
			gender: "Gender as published.",
			elected: "1 if elected.",
		},
	},
	v_contest: {
		audience: "core",
		description:
			"View: each contest with its election, area, region, country and party keys spelled out.",
		columns: {
			contest_id: "contest.id.",
			dataset: "Dataset slug.",
			election: "Election label.",
			kind: "general or local.",
			polling_day: "Polling day.",
			area_code: "Area code.",
			area_name: "Area name.",
			geography: "Geography slug.",
			release: "Release slug.",
			authority_code: "Council code, for local elections.",
			authority_name: "Council name.",
			region: "Region name.",
			country: "Country name.",
			constituency_type: "Borough or County.",
			result: "Result text.",
			first_party: "Leading party code.",
			second_party: "Second party code.",
			winner: "Winning party key.",
			dataset_id: "dataset.id.",
			area_version_id: "area_version.id.",
		},
	},
	v_candidacy: {
		audience: "core",
		description:
			"View: each elected candidate with party, the party's votes in the contest and its share of valid votes (computed, not stored).",
		columns: {
			contest_id: "contest.id.",
			position: "Order within the contest.",
			given_name: "Given name.",
			family_name: "Family name.",
			gender: "Gender.",
			elected: "1 if elected.",
			dataset: "Dataset slug.",
			election: "Election label.",
			polling_day: "Polling day.",
			area_code: "Area code.",
			area_name: "Area name.",
			party: "Party code.",
			party_name: "Party name.",
			party_votes:
				"Votes for the party in the contest. Null for independents and others without a party-votes series.",
			valid_votes: "Valid votes in the contest.",
			party_vote_share: "100 * party_votes / valid_votes.",
		},
	},
	place: {
		audience: "core",
		description:
			"A named place made of areas, such as a ceremonial county, historic county, region or an editorial grouping like 'Greater Manchester'. Its areas are in place_member.",
		columns: {
			id: "Integer id, stable across builds.",
			slug: "Text id of the place, as the API and the artifacts call it.",
			position: "Display order.",
			fields: "Internal: JSON list of the properties the API returns.",
			label: "Display name.",
			kind: "ceremonial-county, historic-county, county, combined-authority, region, country or editorial-grouping.",
			definition_revision: "Revision number of the place's definition.",
			member_geography:
				"The geography of its member areas (geography.slug).",
			valid_from: "First date the definition applies, or null.",
			valid_to:
				"Date the definition stops applying (exclusive), or null.",
			min_x: "Bounding box west edge, longitude.",
			min_y: "Bounding box south edge, latitude.",
			max_x: "Bounding box east edge, longitude.",
			max_y: "Bounding box north edge, latitude.",
			source: "JSON: where the definition comes from.",
		},
	},
	place_member: {
		audience: "core",
		description:
			"The areas that make up a place. area_id is the area itself, not one release of it: join area_version for names and boundaries, or v_area_current for the latest.",
		columns: {
			place_id: "The place (place.id).",
			position: "Order.",
			area_id:
				"The member area (area.id), in the place's member_geography.",
		},
	},
	place_assertion: {
		audience: "reference",
		description:
			"Dated statements that an area was part of a place, for places whose membership changed.",
		columns: {
			place_id: "The place.",
			position: "Order.",
			area_id: "The member area (area.id).",
			valid_from: "First date of membership, or null.",
			valid_to: "Date membership ends (exclusive), or null.",
		},
	},
	place_partial_member: {
		audience: "reference",
		description: "Areas only partly inside a place, with the share inside.",
		columns: {
			place_id: "The place.",
			position: "Order.",
			area_id: "The area (area.id).",
			share: "Share of the area inside the place (0 to 1).",
			member_of: "The other place the rest belongs to (place.id).",
		},
	},
	place_location: {
		audience: "core",
		description:
			"A representative point for each named place, calculated from its stored place_geometry. Join place_geometry for its WGS84 bounding box. A gap records where no usable polygon exists.",
		columns: {
			place_id: "The named place (place.id).",
			longitude: "WGS84 longitude in decimal degrees, null for a gap.",
			latitude: "WGS84 latitude in decimal degrees, null for a gap.",
			method: "polygon-interior-point, a point strictly inside the stored polygon, not a population-weighted centroid.",
			gap: "no-geometry or no-interior-point; null when a point is available.",
		},
	},
	place_geometry: {
		audience: "reference",
		description:
			"Outline of a place: Brotli-compressed GeoJSON in WGS84, rounded to about 1 m. Not readable in plain SQL.",
		columns: {
			place_id: "The place.",
			boundary_release: "Release of the member boundaries used.",
			min_x: "Bounding box west edge, longitude.",
			min_y: "Bounding box south edge, latitude.",
			max_x: "Bounding box east edge, longitude.",
			max_y: "Bounding box north edge, latitude.",
			geometry: "Brotli-compressed GeoJSON geometry.",
		},
	},
	postcode: {
		audience: "core",
		description:
			"Every UK postcode, live and terminated, with its location and the areas it falls in. Columns ending _area_id point at area_version.id through postcode_area_set; postcode_decoded gives codes.",
		columns: {
			postcode:
				"The postcode in upper case with no space, such as M11AE. Strip spaces from user input before matching.",
			easting: "British National Grid easting in metres.",
			northing: "British National Grid northing in metres.",
			latitude_microdegrees:
				"WGS 84 latitude in microdegrees, rounded to six decimal degrees (about 0.1 metre resolution); null without a centroid.",
			longitude_microdegrees:
				"WGS 84 longitude in microdegrees, rounded to six decimal degrees (about 0.1 metre resolution); null without a centroid.",
			quality: "Positional quality code from the ONS Postcode Directory.",
			country: "Country code.",
			introduced: "When the postcode was introduced (YYYYMM).",
			terminated: "When it was terminated (YYYYMM), or null if live.",
			large_user: "1 for a large-user postcode (one organisation).",
			area_set_id:
				"The set of areas the postcode falls in (postcode_area_set.id).",
		},
		columnPatterns: [
			{
				pattern: "<geography>_<release>_distance_cm",
				suffix: "_distance_cm",
				description:
					"Distance in centimetres from the postcode to the nearest boundary of its area in that release. Null when the postcode is inside it. A column without a release covers the geography's only held release.",
			},
		],
	},
	postcode_area_set: {
		audience: "core",
		description:
			"Distinct combinations of areas postcodes fall in. Many postcodes share a set.",
		columns: { id: "Set id." },
		columnPatterns: [
			{
				pattern: "<geography>_<release>_area_id",
				suffix: "_area_id",
				description:
					"The area the postcode falls in for that release (area_version.id), or null if outside its coverage.",
			},
		],
	},
	postcode_decoded: {
		audience: "core",
		description:
			"View: postcode with every area id and area code spelled out. Use this to look up a postcode.",
		columns: {
			postcode:
				"The postcode in upper case with no space, such as M11AE. Strip spaces from user input before matching.",
			easting: "British National Grid easting in metres.",
			northing: "British National Grid northing in metres.",
			latitude:
				"WGS 84 latitude in decimal degrees, rounded to six decimal places (about 0.1 metre resolution); null without a centroid.",
			longitude:
				"WGS 84 longitude in decimal degrees, rounded to six decimal places (about 0.1 metre resolution); null without a centroid.",
			quality: "Positional quality code from the ONS Postcode Directory.",
			country: "Country code.",
			introduced: "When the postcode was introduced (YYYYMM).",
			terminated: "When it was terminated (YYYYMM), or null if live.",
			large_user: "1 for a large-user postcode (one organisation).",
		},
		columnPatterns: [
			{
				pattern: "<geography>_<release>_area_id",
				suffix: "_area_id",
				description: "As postcode_area_set.",
			},
			{
				pattern: "<geography>_<release>_distance_cm",
				suffix: "_distance_cm",
				description: "As postcode.",
			},
			{
				pattern: "<geography>_<release>_code",
				suffix: "_code",
				description: "The area code for that release.",
			},
		],
	},
	postcode_area_release: {
		audience: "internal",
		description: "Which postcode columns hold which geography and release.",
		columns: {},
	},
	postcode_area_match: {
		audience: "internal",
		description:
			"Postcodes near a boundary that match more than one area, with containment and distance. Used by the API.",
		columns: {},
	},
	postcode_area_match_decoded: {
		audience: "internal",
		description: "View: postcode_area_match with codes and names.",
		columns: {},
	},
	meta: {
		audience: "reference",
		description:
			"File settings and provenance: schemaVersion matches PRAGMA user_version. buildId hashes the assembled work file and provenance; buildTimestamp is present only when SOURCE_DATE_EPOCH is supplied. gitCommit and gitDirty are present when Git is available; gitDirty includes non-ignored untracked files. dataRelease is present when data-release.json exists. PRAGMA application_id is 0x554b4441 (UKDA). File hashes are in the release manifest.",
		columns: { key: "Setting name.", value: "Setting value." },
	},
	schema_table: {
		audience: "core",
		description:
			"One row per table or view of this file, with its audience and what it is for. Start with schema_guide, then read this.",
		columns: {
			name: "Table or view name.",
			kind: "'table' or 'view'.",
			audience:
				"'core' (start here), 'reference' (provenance, quality and detail) or 'internal' (build or API plumbing an analyst can ignore).",
			description: "What the table or view is for.",
		},
	},
	schema_column: {
		audience: "core",
		description:
			"One row per column of every core and reference table or view, and of any internal one that documents its columns. Columns that follow a pattern, such as the postcode release columns, are listed one by one.",
		columns: {
			table_name: "The table or view (schema_table.name).",
			column_name: "Column name, exactly as the table spells it.",
			description:
				"What the column holds, with its unit where it has one.",
		},
	},
	schema_guide: {
		audience: "core",
		description:
			"Short topics that explain how to read the data, in reading order. Read them all once: SELECT * FROM schema_guide ORDER BY position.",
		columns: {
			topic: "Topic slug, such as start-here or aggregating.",
			position: "Reading order, from 1.",
			body: "The text of the topic.",
		},
	},
	schema_example: {
		audience: "core",
		description:
			"Worked questions with SQL that runs as written on this file. Copy one and change the codes.",
		columns: {
			id: "Example slug.",
			position: "Order in the list, from 1.",
			question: "The question in plain words.",
			sql: "A query that answers it.",
			expect: "What the query returns, so you can check you have it right.",
		},
	},
	search: {
		audience: "core",
		description:
			"Full-text search over measures, datasets, dimension members, areas and places. SELECT kind, key, label FROM search WHERE search MATCH 'household*' ORDER BY rank. Add kind = 'measure' to narrow it. Words match their stems (household and households) and a trailing * matches a prefix.",
		columns: {
			kind: "'measure', 'dataset', 'dimension_member', 'area' or 'place'.",
			key: "How to find the row in its own table: the slug for a measure or dataset, 'dimension-slug:code' for a dimension member, the area code for an area, the place slug for a place.",
			label: "The name to show: the measure label, dataset title, member label or the area's name on its latest boundary release.",
			body: "More searchable text: a measure's description and unit, a dataset's description and module, a member's dimension, an area's geography, a place's kind and member geography.",
		},
	},
};

export const schemaExamples: readonly SchemaExample[] = [
	{
		id: "converted-series-sources",
		question:
			"Which sources and licences are behind the converted ward series for under-1s on the 2026 boundaries, and how does each reach it?",
		sql: "SELECT source_id, publisher, via, depth, licences, commercial_use, share_alike FROM v_series_attribution WHERE series = 'population/population/ward:2023-12-uk-bgc/age=0/sex=all~converted:ward:2026-05-uk-bgc' ORDER BY depth, source_id",
		expect: "Two rows, both Office for National Statistics under ogl-3.0 and both commercial-safe and not ShareAlike: the population dataset itself (via dataset, depth 0) and the crosswalk provenance that moves it onto the new boundaries (via crosswalk, depth 1).",
	},
	{
		id: "notional-election-terms",
		question:
			"Can the notional 2019 general election vote for Labour be used commercially, and must a copy be ShareAlike?",
		sql: "SELECT series, licences, commercial_use, share_alike, attribution FROM v_series_terms WHERE series LIKE 'general-election/party-votes/constituency:2019-12-uk-bgc/party=lab~notional-%' ORDER BY series",
		expect: "Two rows, one per model. notional-open is under ogl-3.0 and open-parliament, commercial_use 1 and share_alike 0. notional-sharealike also takes cc-by-sa-3.0 from the Local Elections Archive Project results, so share_alike is 1 and the attribution carries the ShareAlike statement.",
	},
	{
		id: "population-attribution",
		question:
			"What attribution text goes with Manchester's most recent population figure?",
		sql: "SELECT o.period, o.value, t.commercial_use, t.share_alike, t.attribution FROM v_observation_default o JOIN v_series_terms t ON t.series_id = o.series_id WHERE o.measure = 'population' AND o.area_code = 'E08000003' ORDER BY o.period DESC LIMIT 1",
		expect: "One row for the latest period: the value, commercial_use 1, share_alike 0 and a ready-to-print string that names each publisher once, the Open Government Licence statement and the OS and Royal Mail notices.",
	},
	{
		id: "sharealike-series-count",
		question:
			"How many series of each method are ShareAlike, and how many have terms that are not known?",
		sql: "SELECT method, count(*) AS series, sum(share_alike = 1) AS sharealike, sum(share_alike IS NULL OR commercial_use IS NULL) AS unknown FROM v_series_terms GROUP BY method ORDER BY method",
		expect: "One row each for converted, modelled and published. A converted or modelled series is ShareAlike when any input it was built from is, so converted and modelled rows have more than their own dataset's licence would give. The unknown column is 0 in a release that builds.",
	},
	{
		id: "area-location",
		question: "Where is Manchester and what bounds does its area cover?",
		sql: "SELECT v.geography, v.release, l.latitude, l.longitude, l.min_longitude, l.min_latitude, l.max_longitude, l.max_latitude, l.method, l.gap FROM v_area_version v JOIN area_location l ON l.area_version_id = v.area_version_id WHERE v.code = 'E08000003' ORDER BY v.geography, v.release",
		expect: "A point and bounding box or an explicit gap for each Manchester area version.",
	},
	{
		id: "measure-semantics",
		question:
			"What statistic, unit and population does the fuel poverty rate use?",
		sql: "SELECT m.slug, m.statistic, u.label AS unit, u.kind, u.scale, p.label AS population FROM measure m JOIN unit u ON u.id = m.unit_id JOIN universe p ON p.id = m.universe_id WHERE m.slug = 'fuel-poverty-rate'",
		expect: "One rate, in percent, for households.",
	},
	{
		id: "unemployment-over-time",
		question: "What was the unemployment rate in Manchester each year?",
		sql: "SELECT period, value, lower, upper, status FROM v_observation_default WHERE measure = 'unemployment-rate' AND area_code = 'E08000003' ORDER BY period",
		expect: "26 rows from 1996-97, on localAuthority 2024-05-uk-bgc, all published.",
	},
	{
		id: "default-population-of-authority",
		question:
			"What is the population of Manchester on the 2026 council boundaries, one figure for each period?",
		sql: "SELECT period, round(value) AS population, dataset, method, alternatives FROM v_observation_default WHERE measure = 'population' AND area_code = 'E08000003' AND geography = 'localAuthority' AND release = '2026-05-uk-bgc' ORDER BY period",
		expect: "One row each for 2021, 2022 and 2025, all converted, and none for the single-year-of-age series, whose parts are not totals. The same query on v_observation returns 1,550 rows.",
	},
	{
		id: "default-households-in-lsoa",
		question:
			"How many households were in LSOA E01005189 at the 2021 census, as one figure?",
		sql: "SELECT period, value, dataset, alternatives FROM v_observation_default WHERE measure = 'households' AND area_code = 'E01005189' AND geography = 'lsoa' AND release = '2021-12-ew-bgc-v5' AND period = '2021-census'",
		expect: "One row, 800 from census-2021-ts054, with alternatives 2: housing-tenure repeats it and census-2021-ts003 counts 802 under its own disclosure control. v_observation returns 32 rows, the parts of each census table included.",
	},
	{
		id: "default-party-vote-share",
		question:
			"What share of the vote did each party group win in Manchester Central at the 2019 general election?",
		sql: "SELECT members, round(value, 1) AS share, dataset FROM v_observation_default WHERE measure = 'party-vote-share' AND area_code = 'E14000807' AND geography = 'constituency' AND release = '2019-12-uk-bgc' AND period = '2019-12-12' ORDER BY value DESC",
		expect: "Four rows from historical-general-election: lab 70.4, con 14.8, other 8.2 and lib 6.5. party-group is a qualifier, so each group is its own quantity and none is left out.",
	},
	{
		id: "coverage-population-periods",
		question:
			"Which periods of population exist for local authorities on the latest release, and by which method?",
		sql: "SELECT period, method, dataset, areas_with_value, release_areas, share, countries, is_default FROM v_coverage WHERE measure = 'population' AND geography = 'localAuthority' AND release = '2026-05-uk-bgc' AND members IS NULL ORDER BY period, preference_rank",
		expect: "Three rows, all converted onto the 2026-05 boundaries: 2021 and 2022 from population-constituency (318 of 361 areas, England and Wales, share 0.88) and 2025 from imd (296 areas, England only, share 0.82, the default). No period is published directly on this release.",
	},
	{
		id: "coverage-median-pay-geographies",
		question: "Which geographies can I get median gross annual pay on?",
		sql: "SELECT geography, release, members, method, period, areas_with_value, release_areas, share, countries FROM v_coverage WHERE measure = 'gross-annual-pay' AND members LIKE '%pay-statistic=median%' ORDER BY geography, release, members",
		expect: "Eight rows, all published for 2025, England only: region (9 of 9), localAuthority (about 294 of 361), countyAndUnitaryAuthority (21 of 218) and country (1 of 4), each for residence and for workplace earnings.",
	},
	{
		id: "coverage-missing-ward-claimant-rate",
		question:
			"Why is the claimant rate not available on the 2026 ward boundaries?",
		sql: "SELECT measure, geography, release, reason, explanation, dataset, source_release FROM v_coverage_missing WHERE measure = 'claimant-rate' AND geography = 'ward'",
		expect: "Two rows, both refused-measure from claimant-count (published on 2024-05 and 2022-12 local authorities): the claimants are held but the 16 to 64 population is not held as a measure, so the rate cannot be rebuilt on wards.",
	},
	{
		id: "area-by-code",
		question:
			"Which geographies and boundary releases is E08000003 in, and what is it called?",
		sql: "SELECT geography, release, name FROM v_area_version WHERE code = 'E08000003' ORDER BY geography, release",
		expect: "Manchester, in localAuthority and countyAndUnitaryAuthority releases.",
	},
	{
		id: "find-measure",
		question: "Which measures are about households?",
		sql: "SELECT m.slug, m.label, u.label AS unit FROM search JOIN measure m ON m.slug = search.key JOIN unit u ON u.id = m.unit_id WHERE search MATCH 'household*' AND search.kind = 'measure' ORDER BY rank",
		expect: "households, fuel-poor-households, households-in-temporary-accommodation and others, best match first.",
	},
	{
		id: "crime-breakdown",
		question:
			"How many crimes of each type were recorded in Manchester in the latest year?",
		sql: "SELECT o.members, o.period, o.value FROM v_observation o WHERE o.measure = 'recorded-crimes' AND o.area_code = 'E08000003' AND o.period = (SELECT p.label FROM v_observation x JOIN period p ON p.label = x.period WHERE x.measure = 'recorded-crimes' AND x.area_code = 'E08000003' ORDER BY p.end_date DESC LIMIT 1) ORDER BY o.value DESC",
		expect: "offence=total first (84,130 for year-ending-2026-03), then each offence.",
	},
	{
		id: "dimension-hierarchy",
		question: "What crime types are there and how are they grouped?",
		sql: "SELECT m.code, m.label, p.label AS part_of FROM dimension d JOIN dimension_member m ON m.dimension_id = d.id LEFT JOIN dimension_member p ON p.id = m.parent_id WHERE d.slug = 'offence' ORDER BY m.position",
		expect: "All recorded crime at the root, then groups such as Violence against the person with their offences.",
	},
	{
		id: "most-deprived-small-areas",
		question: "Which are the five most deprived LSOAs in Manchester?",
		sql: "WITH lsoa AS (SELECT e.from_version_id AS id FROM crosswalk c JOIN crosswalk_edge e ON e.crosswalk_id = c.id JOIN area_version t ON t.id = e.to_version_id JOIN area a ON a.id = t.area_id WHERE c.slug = 'lsoa-2021-12-ew-bgc-v5-to-local-authority-2023-05-uk-bgc-v2-official-lookup' AND a.code = 'E08000003') SELECT a.code, v.name, p.label AS period, o.value AS imd_rank FROM lsoa JOIN area_version v ON v.id = lsoa.id JOIN area a ON a.id = v.area_id JOIN observation o ON o.area_version_id = v.id AND o.series_id IN (SELECT s.id FROM series s JOIN measure m ON m.id = s.measure_id WHERE m.slug = 'imd-rank' AND s.release_id = v.release_id) JOIN period p ON p.id = o.period_id ORDER BY o.value LIMIT 5",
		expect: "E01005189 Manchester 017D, rank 66 in 2025, first. Rank 1 is the most deprived in England.",
	},
	{
		id: "what-replaced",
		question: "Which councils were merged to form Cumberland?",
		sql: "SELECT DISTINCT pa.code, pv.name FROM area_relationship r JOIN area_version cv ON cv.id = r.child_version_id JOIN area ca ON ca.id = cv.area_id JOIN area_version pv ON pv.id = r.parent_version_id JOIN area pa ON pa.id = pv.area_id WHERE r.relation = 'predecessor' AND ca.code = 'E06000063'",
		expect: "Allerdale E07000026 and Carlisle E07000028 (and Copeland if the publisher lists it). Swap the code filter to ask the reverse: what replaced Allerdale?",
	},
	{
		id: "split-areas",
		question: "Which 2011 LSOAs were split into several 2021 LSOAs?",
		sql: "SELECT DISTINCT from_code, to_code, to_name FROM v_crosswalk_edge WHERE crosswalk = 'lsoa-2011-12-ew-bgc-v3-to-2021-12-ew-bgc-v5-official-lookup' AND change = 'split' ORDER BY from_code LIMIT 20",
		expect: "E01000010 split into E01034473 and E01034474, and others. v_crosswalk_edge has one row per weight basis, hence DISTINCT.",
	},
	{
		id: "what-replaced-allerdale",
		question: "What replaced Allerdale?",
		sql: "SELECT * FROM v_area_change WHERE event_id IN (SELECT event_id FROM v_area_change WHERE code = 'E07000026' AND side = 'from') ORDER BY side, code",
		expect: "One merged event with effective_date 2023-04-01 (date_basis 'legal'; its edition_date is 2023-05-01): Allerdale E07000026, Carlisle E07000028 and Copeland E07000029 (from) became Cumberland E06000063 (to).",
	},
	{
		id: "legal-date-vs-edition",
		question:
			"How far do release editions lag the legal date of a change, by geography?",
		sql: "SELECT geography, count(DISTINCT event_id) AS dated_events, min(julianday(edition_date) - julianday(effective_date)) AS min_days, round(avg(julianday(edition_date) - julianday(effective_date))) AS mean_days, max(julianday(edition_date) - julianday(effective_date)) AS max_days FROM v_area_change WHERE side = 'from' AND date_basis = 'legal' GROUP BY geography ORDER BY geography",
		expect: "One row per geography that has legal dates (constituency, localAuthority, lsoa, msoa, outputArea, parish and ward), with the days from the legal date to the edition that first holds the change. The minimum is -30 (a change later in its edition month) and the maximum is above 1,000 for a change an edition held years late. Geographies the database does not cover (ITL, Scottish Parliamentary constituencies) have no row.",
	},
	{
		id: "ward-after-2023",
		question:
			"What did the Alexandra ward (E05000719) in 2022 become in 2023?",
		sql: "SELECT kind, effective_date, side, code, name FROM v_area_change WHERE geography = 'ward' AND event_id IN (SELECT event_id FROM v_area_change WHERE code = 'E05000719' AND side = 'from' AND from_release = '2022-12-uk-bgc') ORDER BY side, code",
		expect: "One redistributed event with effective_date 2023-05-04 (the ward elections that brought the new wards into force, date_basis 'legal'; edition_date 2023-05-01), basis 'official-lookup', realigned 1: the fifteen Oldham wards of 2022 (E05000719 Alexandra to E05000738 Werneth) and the fifteen of 2023 (E05014646 Alexandra and the others), 30 rows. E05000719 Alexandra became E05014646 Alexandra on the extent-continuity crosswalk, so lineage lookups follow it. A ward with no row was unchanged, or changed extent without a new code.",
	},
	{
		id: "ward-redrawn",
		question:
			"Which wards kept their code but changed extent, and was the change a realignment of the line?",
		sql: "SELECT code, name, from_release, to_release, effective_date, realigned FROM v_area_change WHERE geography = 'ward' AND kind = 'redrawn' AND side = 'from' ORDER BY from_release, code LIMIT 20",
		expect: "41 wards in all, from E05005193 Heyhouses in the 2011-12 to 2015-12 pair. realigned is 1 where an extent-continuity crosswalk matched the ward to the same area after a small boundary move, and 0 where it changed extent and no successor is claimed.",
	},
	{
		id: "ward-recoded-by-realignment",
		question: "Which wards got a new code because their line moved?",
		sql: "SELECT f.code, f.name, t.code AS became, t.name AS became_name, f.effective_date FROM v_area_change f JOIN v_area_change t ON t.event_id = f.event_id AND t.side = 'to' WHERE f.geography = 'ward' AND f.kind = 'recoded' AND f.realigned = 1 AND f.side = 'from' ORDER BY f.effective_date, f.code LIMIT 20",
		expect: "138 wards in all, from E05003724 Castle, which became E05010750 Castle in 2015-12. The pair was found from the extents. Where a publisher's lookup puts the ward inside a redistribution, the event is a redistributed one with realigned 1 instead, so the 2023 Oldham wards are not here.",
	},
	{
		id: "ward-splits-2025",
		question: "Which wards in England split in 2025?",
		sql: "SELECT f.code, f.name, count(*) AS parts, group_concat(t.code, ' ') AS became, f.basis FROM v_area_change f JOIN v_area_change t ON t.event_id = f.event_id AND t.side = 'to' WHERE f.geography = 'ward' AND f.kind = 'split' AND f.side = 'from' AND f.effective_date >= '2025-01-01' GROUP BY f.event_id ORDER BY f.code",
		expect: "Two wards, both with effective_date 2025-05-01 (date_basis 'legal') and basis 'official-lookup': E05008153 Church Stretton and Craven Arms became E05016036 and E05016076, and E05013142 Downley became E05015948 and E05015949.",
	},
	{
		id: "ward-merges-by-year",
		question: "How many ward merges took legal effect in each year?",
		sql: "SELECT substr(effective_date, 1, 4) AS year, count(DISTINCT event_id) AS merges FROM v_area_change WHERE geography = 'ward' AND kind = 'merged' AND basis = 'official-lookup' AND date_basis = 'legal' GROUP BY year ORDER BY year",
		expect: "Twelve years from 2012 to 2025, the most in 2022 (139) and 2015 (23), with 2019 (22), 2021 (14), 2018 (12) and 2023 (12) after. Ward merges take legal effect at the May elections. Only an official lookup (the ONS Code History Database for wards) can show a merge, so a year with none may simply have no lookup.",
	},
	{
		id: "lsoa-splits-2021",
		question: "Which 2011 LSOAs were split in the 2021 boundaries?",
		sql: "SELECT f.code, f.name, count(*) AS parts, group_concat(t.code, ' ') AS became FROM v_area_change f JOIN v_area_change t ON t.event_id = f.event_id AND t.side = 'to' WHERE f.geography = 'lsoa' AND f.kind = 'split' AND f.effective_date = '2021-03-21' AND f.side = 'from' GROUP BY f.event_id ORDER BY f.code LIMIT 20",
		expect: "861 LSOAs in all, from E01000010 Barking and Dagenham 015C, which became E01034473 and E01034474.",
	},
	{
		id: "output-area-splits-2021",
		question: "Which 2011 output areas were split in the 2021 boundaries?",
		sql: "SELECT f.code, count(*) AS parts, group_concat(t.code, ' ') AS became FROM v_area_change f JOIN v_area_change t ON t.event_id = f.event_id AND t.side = 'to' WHERE f.geography = 'outputArea' AND f.kind = 'split' AND f.effective_date = '2021-03-21' AND f.side = 'from' GROUP BY f.event_id ORDER BY f.code LIMIT 20",
		expect: "4,684 output areas in all, from E00000026, which became E00190405 and E00190440. The Code History Database names output areas by their code, so the name column is not used.",
	},
	{
		id: "parish-merges",
		question:
			"Which parishes in England and Wales were merged, and from which parishes?",
		sql: "SELECT t.code, t.name, t.effective_date, count(*) AS parts, group_concat(f.code, ' ') AS merged_from FROM v_area_change t JOIN v_area_change f ON f.event_id = t.event_id AND f.side = 'from' WHERE t.geography = 'parish' AND t.kind = 'merged' AND t.side = 'to' GROUP BY t.event_id ORDER BY t.effective_date, t.code",
		expect: "25 merges from 2020-04-01 to 2026-04-01, the first E04013023 Selside and Fawcett Forest, merged from E04002604 and E04002660. All have basis 'official-lookup'.",
	},
	{
		id: "local-authority-2009-reorganisation",
		question:
			"Which district councils were merged into the new unitary authorities in 2009?",
		sql: "SELECT t.code, t.name, t.effective_date, t.date_basis, count(*) AS parts FROM v_area_change t JOIN v_area_change f ON f.event_id = t.event_id AND f.side = 'from' WHERE t.geography = 'localAuthority' AND t.kind = 'merged' AND t.side = 'to' AND t.from_release = '2008-12-gb-bgc' GROUP BY t.event_id ORDER BY t.code",
		expect: "Eight authorities, all with effective_date 2009-04-01 (date_basis 'legal'): County Durham (7 districts), Northumberland (7), Shropshire (5), Cornwall (6), Wiltshire (4), Cheshire East (3), Cheshire West and Chester (3) and Central Bedfordshire (2). The 2008 release uses the old ONS codes, such as 09UC for Mid Bedfordshire.",
	},
	{
		id: "ward-to-constituency",
		question:
			"Which 2024 constituencies does each 2022 ward fall in, and what share of its residents goes to each?",
		sql: "SELECT from_code, to_code, weight FROM v_crosswalk_weight WHERE crosswalk = 'ward-2022-12-uk-bgc-to-constituency-2024-07-uk-bgc-postcode-overlap' AND basis = 'population' ORDER BY from_code, weight DESC LIMIT 20",
		expect: "Weights summing to 1 per ward.",
	},
	{
		id: "old-ward-to-current",
		question:
			"Where is the ward E05000719 now, whichever release it was in, and what share of its residents is in each current ward?",
		sql: "SELECT from_release, to_release, from_code, to_code, to_name, weight, weight_lower, weight_upper, complete FROM v_crosswalk_chain_edge WHERE geography = 'ward' AND from_code = 'E05000719' AND basis = 'population' ORDER BY from_release, to_code LIMIT 20",
		expect: "One or more rows for each release the ward is in, all to the current ward release. Weights sum to 1 per release. complete is 1 where every ward feeding the current ward has a route to it.",
	},
	{
		id: "old-count-on-current-wards",
		question:
			"What was the population of age 0 in the 2023-12 wards, carried to the current wards?",
		sql: "SELECT e.to_code, e.to_name, round(sum(o.value * e.weight), 1) AS value, min(e.complete) AS complete, count(*) AS parts FROM v_observation o JOIN v_crosswalk_chain_edge e ON e.geography = o.geography AND e.from_release = o.release AND e.from_code = o.area_code AND e.basis = 'population' WHERE o.measure = 'population' AND o.members = 'sex=all; age=0' AND o.geography = 'ward' AND o.release = '2023-12-uk-bgc' GROUP BY e.to_code, e.to_name ORDER BY e.to_code LIMIT 5",
		expect: "One row per current ward, from E05000954 Bebington (124.0) on. A count is the sum of each old ward's value times its weight. The sum is lower than the old total, because the wards in v_crosswalk_chain_gap carry nothing.",
	},
	{
		id: "old-areas-that-lose-value",
		question:
			"Which 2023-12 wards have no current ward to carry their value to?",
		sql: "SELECT g.from_code, g.from_name, g.reason, g.has_edge FROM v_crosswalk_chain_gap g WHERE g.geography = 'ward' AND g.from_release = '2023-12-uk-bgc' AND g.basis = 'population' ORDER BY g.from_code LIMIT 5",
		expect: "Birkdale E05000933 and its neighbours in Sefton, reason not-in-crosswalk and has_edge 0: no route reaches a current ward from them. A gap with has_edge 1 reaches some current wards but loses part of its value.",
	},
	{
		id: "converted-quality",
		question:
			"Is there population data on the 2026 council boundaries, and how was it made?",
		sql: "SELECT s.key, c.rule, b.label AS basis, c.exact_share, c.coverage FROM series s JOIN measure m ON m.id = s.measure_id JOIN area_release r ON r.id = s.release_id JOIN series_conversion c ON c.series_id = s.id LEFT JOIN weight_basis b ON b.id = c.basis_id WHERE m.slug = 'population' AND r.geography = 'localAuthority' AND r.release = '2026-05-uk-bgc' LIMIT 10",
		expect: "Converted series from 2023-12-uk-bgc, rule sum, residents basis, exact_share 1.",
	},
	{
		id: "why-not-converted",
		question:
			"Why is the unemployment rate not available on the latest boundaries?",
		sql: "SELECT mc.rule, mc.reason FROM measure_conversion mc JOIN measure m ON m.id = mc.measure_id WHERE m.slug = 'unemployment-rate'",
		expect: "refuse: a model-based rate whose denominator is not held.",
	},
	{
		id: "election-result",
		question:
			"Who won the Manchester constituencies at the 2024 general election?",
		sql: "SELECT area_code, area_name, winner, second_party, result FROM v_contest WHERE dataset = 'general-election' AND polling_day = '2024-07-04' AND area_name LIKE 'Manchester%'",
		expect: "Labour holds in Manchester Central, Rusholme and Withington.",
	},
	{
		id: "boundaries-on-date",
		question: "Which ward boundaries were the latest held on 1 June 2023?",
		sql: "SELECT release, edition_from, edition_until FROM boundary_release_edition WHERE geography = 'ward' AND edition_from <= '2023-06-01' AND (edition_until IS NULL OR edition_until > '2023-06-01')",
		expect: "2023-05-uk-bgc.",
	},
	{
		id: "licence-check",
		question:
			"Which datasets cannot be used commercially or must be shared alike?",
		sql: "SELECT d.slug, t.licences, t.commercial_use, t.share_alike FROM dataset d JOIN v_source_terms t ON t.source_id = d.source_id WHERE t.share_alike = 1 OR t.commercial_use = 0",
		expect: "local-election (CC BY-SA).",
	},
	{
		id: "area-now",
		question: "What is E08000003 called now, and in which release?",
		sql: "SELECT code, name, geography, release FROM v_area_current WHERE code = 'E08000003' ORDER BY geography",
		expect: "Manchester, in its latest localAuthority and countyAndUnitaryAuthority releases.",
	},
	{
		id: "series-of-measure",
		question:
			"Which datasets publish recorded crimes, and on which boundaries?",
		sql: "SELECT dataset, members, geography, release, method FROM v_series WHERE measure = 'recorded-crimes' ORDER BY dataset, geography, release, members LIMIT 20",
		expect: "One row per series: a dataset, the offence member, its geography and release, and the method.",
	},
	{
		id: "find-place",
		question: "Which places are called Aberdeenshire?",
		sql: "SELECT key, label FROM search WHERE search MATCH 'aberdeenshire' AND kind = 'place' ORDER BY rank",
		expect: "Aberdeenshire (historic county) and any other place with the word in its name.",
	},
	{
		id: "places-of-area",
		question: "Which places is Manchester (E08000003) part of?",
		sql: "SELECT p.slug, p.label, p.kind FROM place_member m JOIN place p ON p.id = m.place_id JOIN area a ON a.id = m.area_id JOIN geography g ON g.id = a.geography_id AND g.slug = p.member_geography WHERE a.code = 'E08000003' ORDER BY p.position",
		expect: "Greater Manchester and the other places that include the council, such as its historic and ceremonial counties.",
	},
	{
		id: "postcode-lookup",
		question: "Which council and ward is postcode M1 1AE in?",
		sql: "SELECT postcode, latitude, longitude, local_authority_2026_05_uk_bgc_code AS council, ward_2026_05_uk_bgc_code AS ward, terminated FROM postcode_decoded WHERE postcode = replace(upper('M1 1AE'), ' ', '')",
		expect: "E08000003 (Manchester) and its 2026 ward. Postcodes are stored without a space, and column names carry the release.",
	},
];

export const schemaDocs: SchemaDocs = {
	guide: schemaGuide,
	tables: schemaTables,
	examples: schemaExamples,
};
