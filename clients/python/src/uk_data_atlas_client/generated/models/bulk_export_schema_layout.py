from enum import StrEnum


class BulkExportSchemaLayout(StrEnum):
    PERIODS = "periods"
    SINGLE_PERIOD = "single-period"
    TABLE = "table"

    def __str__(self) -> str:
        return str(self.value)
