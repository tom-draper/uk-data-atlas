from enum import StrEnum


class GetMeasureObservationsFormat(StrEnum):
    CSV = "csv"
    JSON = "json"
    NDJSON = "ndjson"

    def __str__(self) -> str:
        return str(self.value)
