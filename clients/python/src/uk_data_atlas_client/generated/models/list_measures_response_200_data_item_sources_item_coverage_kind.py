from enum import StrEnum


class ListMeasuresResponse200DataItemSourcesItemCoverageKind(StrEnum):
    PARTIAL = "partial"
    SOURCE_REPORTED = "source-reported"

    def __str__(self) -> str:
        return str(self.value)
