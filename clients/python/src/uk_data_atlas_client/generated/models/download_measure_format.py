from enum import StrEnum


class DownloadMeasureFormat(StrEnum):
    CSV = "csv"
    PARQUET = "parquet"

    def __str__(self) -> str:
        return str(self.value)
