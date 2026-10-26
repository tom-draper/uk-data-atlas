from enum import StrEnum


class CrosswalkMetadataProvenanceType1InputsItemSide(StrEnum):
    FROM = "from"
    TO = "to"

    def __str__(self) -> str:
        return str(self.value)
