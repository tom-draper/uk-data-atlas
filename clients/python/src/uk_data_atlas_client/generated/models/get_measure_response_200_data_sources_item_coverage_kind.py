from enum import StrEnum


class GetMeasureResponse200DataSourcesItemCoverageKind(StrEnum):
    PARTIAL = "partial"
    SOURCE_REPORTED = "source-reported"

    def __str__(self) -> str:
        return str(self.value)
