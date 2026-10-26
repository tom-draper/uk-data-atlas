from enum import StrEnum


class DownloadBulkExportFormat(StrEnum):
    CSV = "csv"
    JSON = "json"
    PARQUET = "parquet"

    def __str__(self) -> str:
        return str(self.value)
