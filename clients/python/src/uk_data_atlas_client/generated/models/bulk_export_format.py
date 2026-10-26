from enum import StrEnum


class BulkExportFormat(StrEnum):
    JSON = "json"

    def __str__(self) -> str:
        return str(self.value)
