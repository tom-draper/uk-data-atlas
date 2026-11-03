from enum import StrEnum


class ProblemCode(StrEnum):
    AGGREGATION_NOT_SUPPORTED = "aggregation_not_supported"
    AMBIGUOUS_DIMENSION = "ambiguous_dimension"
    AMBIGUOUS_PLACE = "ambiguous_place"
    AMBIGUOUS_RELEASE = "ambiguous_release"
    AREA_NOT_IN_RELEASE = "area_not_in_release"
    CONVERSION_NOT_AVAILABLE = "conversion_not_available"
    INCOMPATIBLE_GEOMETRY = "incompatible_geometry"
    INVALID_CURSOR = "invalid_cursor"
    INVALID_FORMAT = "invalid_format"
    NO_MATCHING_SERIES = "no_matching_series"
    NO_RELEASE_FOR_DATE = "no_release_for_date"
    PARTIAL_COVERAGE = "partial_coverage"
    PLACE_NOT_SERVED = "place_not_served"
    RETIRED_MEASURE_ID = "retired_measure_id"
    UNKNOWN_DIMENSION = "unknown_dimension"
    UNKNOWN_DIMENSION_MEMBER = "unknown_dimension_member"
    UNKNOWN_QUERY_PARAMETER = "unknown_query_parameter"
    UNKNOWN_RELEASE = "unknown_release"
    UNSUPPORTED_GEOGRAPHY = "unsupported_geography"

    def __str__(self) -> str:
        return str(self.value)
