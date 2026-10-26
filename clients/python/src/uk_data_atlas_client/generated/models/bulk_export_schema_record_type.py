from enum import StrEnum


class BulkExportSchemaRecordType(StrEnum):
    CATEGORICAL = "categorical"
    NUMERIC = "numeric"

    def __str__(self) -> str:
        return str(self.value)
