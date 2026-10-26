from enum import StrEnum


class BulkExportProvenanceDatasetsItemRole(StrEnum):
    DERIVED_FROM = "derived-from"
    SOURCE = "source"

    def __str__(self) -> str:
        return str(self.value)
