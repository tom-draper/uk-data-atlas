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
		body: "Join measure.unit_id to unit for kind, scale, currency and symbol, and universe_id to universe for the population or entity base. For percent and per_n, unit scale is the denominator (100 for percent). For count and currency units expressed in thousands or millions it multiplies the published value; otherwise it is 1. Unknown means the common base has not been established; not-applicable means a population base does not apply. statistic describes the statistic; value_kind and unit are retained as legacy text. When statistic is by-dimension, join statistic_dimension_id to dimension and inspect series_member for the member. In the pay measures this is pay-statistic: mean, median or a percentile. For pay-change measures it selects the underlying pay statistic whose percentage change is reported. Five published weighted means lack their weights and conversion refuses them; measure_conversion gives the reasons.",
	},
	{
		topic: "start-here",
		body: "atlas.sqlite holds UK statistics and the geography they are published on. Areas (councils, wards, constituencies, LSOAs and others) are in area and area_version, statistics are in observation, and crosswalks say how areas in one boundary release map onto another. Read schema_table for what each table is for, schema_column for every column, and schema_example for worked questions with tested SQL. Tables with audience 'core' are enough for most questions. The v_ views join the core tables into readable rows: v_observation for statistics, v_series for what a dataset holds, v_area_version for areas, v_area_current for each area's latest name, v_crosswalk_edge and v_crosswalk_weight for crosswalks, v_area_change for areas that were renamed, recoded, split, merged, ended or created, v_contest and v_candidacy for elections, v_source_terms and v_election_terms for licences. search is a full-text index over measures, datasets, dimension members, areas and places: SELECT kind, key, label FROM search WHERE search MATCH 'household*' ORDER BY rank.",
	},
	{
		topic: "areas-and-releases",
		body: "An area is one code in one geography, for all time (area). Boundaries are published in dated releases, such as localAuthority 2025-05-uk-bgc-v2, listed in area_releases and described in boundary_release. An area_version is an area as it is in one release, with that release's name, size and population. The same code in two releases is two area_version rows sharing one area_id. Every statistic is attached to an area_version, so it is always clear which boundaries a figure is on. Some codes appear in more than one geography, for example a metropolitan borough is both a localAuthority and a countyAndUnitaryAuthority, so filter on geography when looking up a code. Release slugs read as YYYY-MM, then the countries covered (uk, gb, ew, en, sc, w, ni), then the boundary detail (bgc generalised and clipped, bfc full and clipped), then a version suffix if the publisher revised it.",
	},
	{
		topic: "statistics",
		body: "A measure is what is counted, in one unit (population, recorded-crimes, unemployment-rate). A dimension is a breakdown of a measure (sex, age, offence, tenure, party) and a dimension_member is one value of it (offence=burglary). Members can have a parent, and the total is usually the root member with code 'total' or 'all'. A series is one dataset's figures for one measure, one set of members and one boundary release. An observation is one value of a series for one area_version and one period. In v_observation the members column lists the fixed members as 'dimension=code; dimension=code'. A measure with dimensions has one series per combination of members, so filter members (or join series_member) to avoid adding a total to its own parts. measure_default_member names the member to use when a question gives none.",
	},
	{
		topic: "published-and-converted",
		body: "series.method is 'published' for figures as the publisher released them, or 'converted' for figures the atlas moved onto a newer boundary release through a crosswalk. A converted series names its inputs in series_input, its route in series_crosswalk, and its rule, weight basis and quality in series_conversion: exact_share is the share of its values that came from regrouping whole areas (1 = no estimation), and coverage is the share of target areas that received a value. Converted values have status 'derived' (exact regrouping) or 'estimated' (split by a weight, with lower and upper bounds). series_gap says why a converted area or period has no value. A question about one area on one boundary release should usually use one method; when both exist, prefer published, and say when a figure is converted.",
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
		body: "A crosswalk relates the areas of one release (from_release_id) to the areas of another (to_release_id). Each crosswalk_edge pairs one from area_version with one to area_version. crosswalk.method says how it was made: official-lookup and clean-containment come from the publisher, best-fit assigns each source area to one target, extent-continuity links the same area across releases, and area-overlap, population-overlap and postcode-overlap split areas by measured overlap. crosswalk_weight holds the weight of an edge on a basis (weight_basis: area, population, households, dwellings, postcodes); weight is the share of the source area on that basis that falls in the target, summing to 1 per source. v_crosswalk_weight also includes the implicit weight of 1 for edges that regroup a whole area. To move a count from one release to another, multiply each source value by its weight on a basis that suits the measure (residents for people, households for households) and sum per target.",
	},
	{
		topic: "boundary-changes",
		body: "Start with v_area_change, which lists what happened to each area whose code, name or extent changed between two releases of one geography. Each event (area_change_event) has a kind (renamed, recoded, split, merged, redistributed, ended or created), the two releases and an effective_date, and its areas are the members on the from side (the earlier release) and the to side. What replaced Allerdale: SELECT * FROM v_area_change WHERE event_id IN (SELECT event_id FROM v_area_change WHERE code = 'E07000026' AND side = 'from'). The dates are edition dates (date_basis 'edition'): the change had happened by the later release's edition, not necessarily on that day, because the atlas does not hold the ONS Code History Database. Events come from the identity crosswalks, which link releases of one geography. Official lookups (local authorities 2022 to 2023 and 2024 to 2025, LSOA 2011 to 2021) show splits and merges. The other identity crosswalks (extent-continuity) only link areas whose extent did not change, so a ward or output area that was split or merged shows as ended and its successors as created, and only recodes and renames are linked: filter on kind and source before treating a missing split as no split. An area that kept its code but changed extent has no event. Publisher statements (area_relationship, relation 'predecessor') add events only where no crosswalk event already holds them, and have source 'publisher'. The crosswalk_edge.change flag (unchanged, split, merged or complex) exists on the LSOA 2011 to 2021 lookup only. area_relationship also holds a publisher's statements that an area sits inside another ('parent'), was published under another's code ('published-as') or has the same extent ('coterminous'); for example Cumberland E06000063 has predecessors Allerdale E07000026 and Carlisle E07000028.",
	},
	{
		topic: "licences",
		body: "Every dataset names a source, and every source has one or more licences (source_licence, licence). licence.commercial_use and licence.share_alike are 0 or 1. v_source_terms rolls them up per source: commercial_use is 1 only if every licence allows it, share_alike is 1 if any licence requires it. Election results can carry their own licence (v_election_terms). Most data is under the Open Government Licence v3.0, which needs attribution; source.citation gives the text. The 2016 to 2019 local elections are CC BY-SA, so anything derived from them must be shared alike.",
	},
	{
		topic: "performance",
		body: "observation is keyed by (series_id, area_version_id, period_id) with no other index. Filtering v_observation on measure and area_code is fast (milliseconds). A query that filters only on area_version_id, or only on period, scans the whole table (about 10.7 million rows). To read everything for one area, first find its series through its release: WHERE series_id IN (SELECT id FROM series WHERE release_id = ?) AND area_version_id = ?.",
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
			release_id: "The boundary release (area_releases.id).",
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
	area_releases: {
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
			recordCount: "Number of areas in the release's boundary file.",
			artifact: "Internal path of the compiled boundary file.",
			contentHash: "Hash of the compiled boundary file.",
			codeProperty: "Name of the code field in the publisher's file.",
			nameProperty: "Name of the name field in the publisher's file.",
			derivedFrom:
				"JSON describing how the release was derived from another source, if it was. Null otherwise.",
			reason: "Why an unavailable release is not held. Null for available releases.",
		},
	},
	boundary_release: {
		audience: "core",
		description:
			"The publisher's description of a boundary release: title, period covered, publisher, licence and deprecation. Keyed by geography and release slug, matching area_releases.",
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
			metadata_hash: "Hash of the registry entry, for change detection.",
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
			fingerprint:
				"Hash of the dataset's inputs and compiler, for change detection.",
			compiled_type:
				"Internal: the compiled payload type the website reads.",
			compiled_sha256: "Internal: hash of the compiled payload.",
			compiled_bytes: "Internal: size of the compiled payload in bytes.",
			payload_id:
				"Internal: payloads.id if the payload is stored whole, else null.",
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
			unit: "Legacy published unit label. Use unit_id for structured metadata.",
			unit_id: "Reference to the value unit (unit.id).",
			statistic:
				"Statistic represented by the value. By-dimension means the statistic is selected by statistic_dimension_id.",
			statistic_dimension_id:
				"Dimension selecting the statistic, or null when statistic is fixed.",
			universe_id:
				"Population or entity base (universe.id), including explicit unknown or not applicable.",
			value_kind:
				"Legacy mixed number and statistic classification, retained for compatibility. Use statistic and unit_id.",
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
			"One dataset's values for one measure and one set of dimension members, on one boundary release. Either published as released or converted onto another release.",
		columns: {
			id: "Stable integer id.",
			dataset_id: "The dataset (dataset.id).",
			measure_id: "The measure (measure.id).",
			release_id:
				"The boundary release its areas are on (area_releases.id).",
			method: "published (as the publisher released it) or converted (moved onto release_id through crosswalks by the atlas).",
			derived_from_id:
				"For a converted series, the published series it came from (series.id). series_input lists every input.",
			key: "Readable unique key: dataset/measure/geography:release/dimension=member..., with ~converted:geography:release appended for converted series.",
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
	measure_default_member: {
		audience: "core",
		description:
			"The member to use for a dimension when a question names none, usually the total.",
		columns: {
			measure: "Measure slug.",
			dimension: "Dimension slug.",
			member: "Member code.",
		},
	},
	observation: {
		audience: "core",
		description:
			"One value: a series, an area version and a period. About 10.7 million rows. Primary key (series_id, area_version_id, period_id) with no other index, so always filter by series_id. v_observation is the readable form.",
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
			"View: every observation as a readable row with dataset, measure, members, area, release, period, value, status, method and licence. Filter on measure and area_code (and geography or release) for fast reads.",
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
			method: "published or converted.",
			licence: "The source's licence as written.",
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
			"Direct child to parent assignments from membership and best-fit crosswalks. Join area_version and area_releases for geography and release, and crosswalk for provenance. Several sources or vintages can give different parents.",
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
			"For a converted series, every series it was computed from and the role each played.",
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
				"The release it is published on (area_releases.id).",
			target_release_id:
				"The standard release it was not moved to (area_releases.id).",
			reason: "refused-measure (measure_conversion says refuse), no-route (no crosswalk path), no-values (every value would be split and splitting is refused), published-on-target (already published there), missing-component (a ratio lacks its numerator, denominator or weight), better-route (every value it would give for a target area and period came from a better source, kept in its place).",
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
			from_release_id: "Release of the source areas (area_releases.id).",
			to_release_id: "Release of the target areas (area_releases.id).",
			method: "official-lookup or clean-containment (from the publisher), best-fit (each source to one target), extent-continuity (same area across releases), geometric-containment, area-overlap, population-overlap or postcode-overlap (split by measured overlap).",
			quality: "publisher-supplied or derived.",
			purpose:
				"identity (same areas across releases), membership (small areas inside larger ones), or null for general mappings.",
			weighting: "JSON description of how weights were computed, if any.",
			basis_id:
				"The crosswalk's main weight basis (weight_basis.id), or null.",
			record_count: "Number of source areas.",
			artifact: "Internal path of the compiled crosswalk.",
			content_hash: "Hash of the compiled crosswalk.",
			provenance:
				"JSON: sources and inputs the crosswalk was built from.",
			validation: "JSON: checks run on the crosswalk and their results.",
			bytes: "Internal: size of the compiled crosswalk in bytes.",
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
			"One change to the areas of a geography between two of its boundary releases: a rename, a new code, a split, a merge, a redistribution, an area that ended or an area that was created. Areas that did not change have no event. The areas involved are in area_change_member. The date is an edition date, not a legal one.",
		columns: {
			id: "Event number. Events are numbered in order of geography, earlier release, later release, then the smallest code on each side, so a rebuild from the same data gives the same ids.",
			geography_id: "The geography (geography.id).",
			from_release_id: "The earlier boundary release (area_releases.id).",
			to_release_id: "The later boundary release (area_releases.id).",
			kind: "renamed (same code, new name), recoded (one area, new code), split (one area became several), merged (several became one), redistributed (several became several, in one tangle of overlaps), ended (no area continues it) or created (no earlier area).",
			effective_date:
				"The later release's edition date (ISO date, boundary_release_edition.edition_from). The change had happened by this edition.",
			date_basis:
				"What effective_date means. 'edition': the edition date of the later release, not the legal date of the change. The ONS Code History Database has legal dates and is not held.",
			source: "What the event is evidenced by: 'crosswalk' (an identity crosswalk) or 'publisher' (a predecessor statement in area_relationship that no crosswalk event holds).",
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
			effective_date: "As area_change_event.effective_date.",
			date_basis: "As area_change_event.date_basis.",
			source: "As area_change_event.source.",
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
			release_id: "The boundary release of its areas (area_releases.id).",
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
	postcodes: {
		audience: "core",
		description:
			"Every UK postcode, live and terminated, with its location and the areas it falls in. Columns ending AreaId point at area_version.id through postcode_area_set; postcodes_decoded gives codes.",
		columns: {
			postcode:
				"The postcode in upper case with no space, such as M11AE. Strip spaces from user input before matching.",
			easting: "British National Grid easting in metres.",
			northing: "British National Grid northing in metres.",
			latitudeMicrodegrees:
				"WGS 84 latitude in microdegrees, rounded to six decimal degrees (about 0.1 metre resolution); null without a centroid.",
			longitudeMicrodegrees:
				"WGS 84 longitude in microdegrees, rounded to six decimal degrees (about 0.1 metre resolution); null without a centroid.",
			quality: "Positional quality code from the ONS Postcode Directory.",
			country: "Country code.",
			introduced: "When the postcode was introduced (YYYYMM).",
			terminated: "When it was terminated (YYYYMM), or null if live.",
			largeUser: "1 for a large-user postcode (one organisation).",
			area_set_id:
				"The set of areas the postcode falls in (postcode_area_set.id).",
		},
		columnPatterns: [
			{
				pattern: "<geography>_<release>DistanceCm",
				suffix: "DistanceCm",
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
				pattern: "<geography>_<release>AreaId",
				suffix: "AreaId",
				description:
					"The area the postcode falls in for that release (area_version.id), or null if outside its coverage.",
			},
		],
	},
	postcodes_decoded: {
		audience: "core",
		description:
			"View: postcodes with every area id and area code spelled out. Use this to look up a postcode.",
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
			largeUser: "1 for a large-user postcode (one organisation).",
		},
		columnPatterns: [
			{
				pattern: "<geography>_<release>AreaId",
				suffix: "AreaId",
				description: "As postcode_area_set.",
			},
			{
				pattern: "<geography>_<release>DistanceCm",
				suffix: "DistanceCm",
				description: "As postcodes.",
			},
			{
				pattern: "<geography>_<release>Code",
				suffix: "Code",
				description: "The area code for that release.",
			},
		],
	},
	postcode_area_releases: {
		audience: "internal",
		description: "Which postcode columns hold which geography and release.",
		columns: {},
	},
	postcode_area_matches: {
		audience: "internal",
		description:
			"Postcodes near a boundary that match more than one area, with containment and distance. Used by the API.",
		columns: {},
	},
	postcode_area_matches_decoded: {
		audience: "internal",
		description: "View: postcode_area_matches with codes and names.",
		columns: {},
	},
	postcode_area_shard_hash: {
		audience: "internal",
		description:
			"Integrity hashes of postcode area shards and stored coordinates.",
		columns: {},
	},
	meta: {
		audience: "reference",
		description:
			"File settings and provenance: schemaVersion matches PRAGMA user_version. buildId hashes the assembled work file and provenance; buildTimestamp is present only when SOURCE_DATE_EPOCH is supplied. gitCommit and gitDirty are present when Git is available; gitDirty includes non-ignored untracked files. dataRelease is present when data-release.json exists. PRAGMA application_id is 0x554b4441 (UKDA). File hashes are in the release manifest.",
		columns: { key: "Setting name.", value: "Setting value." },
	},
	payloads: {
		audience: "internal",
		description:
			"Brotli-compressed JSON documents the API and website load whole, such as the boundary release list. Not readable in plain SQL.",
		columns: {},
	},
	catalogue_measure: {
		audience: "internal",
		description:
			"Maps the API's older catalogue measure ids to a measure and dataset.",
		columns: {},
	},
	catalogue_measure_member: {
		audience: "internal",
		description:
			"The dimension members fixed by each older catalogue measure id.",
		columns: {},
	},
	additional_measure: {
		audience: "internal",
		description:
			"Measure vocabulary the API names but the statistics tables do not store, such as a total computed from parts, with the reason.",
		columns: {},
	},
	additional_dimension: {
		audience: "internal",
		description:
			"Dimension vocabulary the API names but the statistics tables do not store.",
		columns: {},
	},
	additional_dimension_member: {
		audience: "internal",
		description: "Members of additional_dimension.",
		columns: {},
	},
	statistics_read_path: {
		audience: "internal",
		description: "Version and hash of the API's statistics selectors.",
		columns: {},
	},
	statistics_selector: {
		audience: "internal",
		description:
			"How the API reads each of its older endpoints from the statistics tables.",
		columns: {},
	},
	statistics_selector_code: {
		audience: "internal",
		description: "Area code mappings for statistics_selector.",
		columns: {},
	},
	statistics_selector_column: {
		audience: "internal",
		description: "Output columns of a statistics_selector.",
		columns: {},
	},
	statistics_selector_column_member: {
		audience: "internal",
		description: "Members fixed by a selector column.",
		columns: {},
	},
	statistics_selector_list: {
		audience: "internal",
		description: "List options of a statistics_selector.",
		columns: {},
	},
	statistics_selector_member: {
		audience: "internal",
		description: "Members fixed by a statistics_selector.",
		columns: {},
	},
	statistics_selector_option: {
		audience: "internal",
		description: "Flags of a statistics_selector.",
		columns: {},
	},
	statistics_observation_fallback: {
		audience: "internal",
		description:
			"Selectors that could not be read from rows, with the reason. Expected to be empty.",
		columns: {},
	},
	area_inventory_metadata: {
		audience: "internal",
		description: "Version and hashes of the area inventory the build used.",
		columns: {},
	},
	boundary_registry: {
		audience: "internal",
		description:
			"Version and hash of the boundary registry the build used.",
		columns: {},
	},
	crosswalk_inventory_metadata: {
		audience: "internal",
		description:
			"Version and hashes of the crosswalk inventory the build used.",
		columns: {},
	},
	crosswalk_coverage_entry: {
		audience: "internal",
		description:
			"Per release, how many areas any crosswalk relates. Used by the API inventory.",
		columns: {},
	},
	named_location_inventory_metadata: {
		audience: "internal",
		description: "Version and hashes of the named location inventory.",
		columns: {},
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
		sql: "SELECT period, value, lower, upper, status FROM v_observation WHERE measure = 'unemployment-rate' AND area_code = 'E08000003' ORDER BY period",
		expect: "26 rows from 1996-97, on localAuthority 2024-05-uk-bgc, all published.",
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
		sql: "SELECT m.slug, m.label, m.unit FROM search JOIN measure m ON m.slug = search.key WHERE search MATCH 'household*' AND search.kind = 'measure' ORDER BY rank",
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
		expect: "One merged event dated 2023-05-01: Allerdale E07000026, Carlisle E07000028 and Copeland E07000029 (from) became Cumberland E06000063 (to).",
	},
	{
		id: "ward-after-2023",
		question:
			"What did the Alexandra ward (E05000719) in 2022 become in 2023?",
		sql: "SELECT kind, effective_date, side, code, name FROM v_area_change WHERE geography = 'ward' AND event_id IN (SELECT event_id FROM v_area_change WHERE code = 'E05000719' AND side = 'from' AND from_release = '2022-12-uk-bgc') ORDER BY side, code",
		expect: "A recoded event dated 2023-05-01: E05000719 Alexandra became E05014646 Alexandra. A ward with no row was unchanged, or changed extent without a new code.",
	},
	{
		id: "lsoa-splits-2021",
		question: "Which 2011 LSOAs were split in the 2021 boundaries?",
		sql: "SELECT f.code, f.name, count(*) AS parts, group_concat(t.code, ' ') AS became FROM v_area_change f JOIN v_area_change t ON t.event_id = f.event_id AND t.side = 'to' WHERE f.geography = 'lsoa' AND f.kind = 'split' AND f.effective_date = '2021-12-01' AND f.side = 'from' GROUP BY f.event_id ORDER BY f.code LIMIT 20",
		expect: "861 LSOAs in all, from E01000010 Barking and Dagenham 015C, which became E01034473 and E01034474.",
	},
	{
		id: "ward-to-constituency",
		question:
			"Which 2024 constituencies does each 2022 ward fall in, and what share of its residents goes to each?",
		sql: "SELECT from_code, to_code, weight FROM v_crosswalk_weight WHERE crosswalk = 'ward-2022-12-uk-bgc-to-constituency-2024-07-uk-bgc-postcode-overlap' AND basis = 'population' ORDER BY from_code, weight DESC LIMIT 20",
		expect: "Weights summing to 1 per ward.",
	},
	{
		id: "converted-quality",
		question:
			"Is there population data on the 2026 council boundaries, and how was it made?",
		sql: "SELECT s.key, c.rule, b.label AS basis, c.exact_share, c.coverage FROM series s JOIN measure m ON m.id = s.measure_id JOIN area_releases r ON r.id = s.release_id JOIN series_conversion c ON c.series_id = s.id LEFT JOIN weight_basis b ON b.id = c.basis_id WHERE m.slug = 'population' AND r.geography = 'localAuthority' AND r.release = '2026-05-uk-bgc' LIMIT 10",
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
		sql: "SELECT postcode, latitude, longitude, \"localAuthority_2026-05-uk-bgcCode\" AS council, \"ward_2026-05-uk-bgcCode\" AS ward, terminated FROM postcodes_decoded WHERE postcode = replace(upper('M1 1AE'), ' ', '')",
		expect: "E08000003 (Manchester) and its 2026 ward. Postcodes are stored without a space, and column names carry the release, so quote them.",
	},
];

export const schemaDocs: SchemaDocs = {
	guide: schemaGuide,
	tables: schemaTables,
	examples: schemaExamples,
};
