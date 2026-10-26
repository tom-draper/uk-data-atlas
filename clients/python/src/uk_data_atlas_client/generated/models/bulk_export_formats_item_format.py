from enum import StrEnum


class BulkExportFormatsItemFormat(StrEnum):
    CSV = "csv"
    PARQUET = "parquet"

    def __str__(self) -> str:
        return str(self.value)
