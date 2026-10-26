from enum import StrEnum


class DownloadBulkLookupFormat(StrEnum):
    CSV = "csv"
    NDJSON = "ndjson"

    def __str__(self) -> str:
        return str(self.value)
