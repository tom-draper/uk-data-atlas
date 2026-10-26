from enum import StrEnum


class GetAreaIncludeItem(StrEnum):
    CAPABILITIES = "capabilities"
    CITATION = "citation"
    DOSSIER = "dossier"
    METRICS = "metrics"

    def __str__(self) -> str:
        return str(self.value)
