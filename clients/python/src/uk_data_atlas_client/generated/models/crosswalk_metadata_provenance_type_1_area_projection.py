from enum import StrEnum


class CrosswalkMetadataProvenanceType1AreaProjection(StrEnum):
    EPSG6933 = "EPSG:6933"

    def __str__(self) -> str:
        return str(self.value)
