from enum import StrEnum


class TerrainPointSourceProvenance(StrEnum):
    LOCAL = "local"
    REMOTE_PREVIEW = "remote-preview"

    def __str__(self) -> str:
        return str(self.value)
