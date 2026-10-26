from enum import StrEnum


class SuppliedCountConversionEnvelopeDataCoverageScope(StrEnum):
    PUBLISHED_CROSSWALK = "published-crosswalk"

    def __str__(self) -> str:
        return str(self.value)
