from enum import StrEnum


class AreaChildGeometryFeatureType(StrEnum):
    FEATURE = "Feature"

    def __str__(self) -> str:
        return str(self.value)
