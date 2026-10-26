from enum import StrEnum


class AggregationNotSupportedProblemCode(StrEnum):
    AGGREGATION_NOT_SUPPORTED = "aggregation_not_supported"

    def __str__(self) -> str:
        return str(self.value)
