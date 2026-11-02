from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.atlas_release_schema_version import AtlasReleaseSchemaVersion

if TYPE_CHECKING:
    from ..models.atlas_release_artifact_ref import AtlasReleaseArtifactRef


T = TypeVar("T", bound="AtlasRelease")


@_attrs_define
class AtlasRelease:
    """
    Attributes:
        artifacts (list[AtlasReleaseArtifactRef]):
        release_id (str):
        schema_version (AtlasReleaseSchemaVersion):
    """

    artifacts: list[AtlasReleaseArtifactRef]
    release_id: str
    schema_version: AtlasReleaseSchemaVersion
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        artifacts = []
        for artifacts_item_data in self.artifacts:
            artifacts_item = artifacts_item_data.to_dict()
            artifacts.append(artifacts_item)

        release_id = self.release_id

        schema_version = self.schema_version.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "artifacts": artifacts,
                "releaseId": release_id,
                "schemaVersion": schema_version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.atlas_release_artifact_ref import AtlasReleaseArtifactRef

        d = dict(src_dict)
        artifacts = []
        _artifacts = d.pop("artifacts")
        for artifacts_item_data in _artifacts:
            artifacts_item = AtlasReleaseArtifactRef.from_dict(artifacts_item_data)

            artifacts.append(artifacts_item)

        release_id = d.pop("releaseId")

        schema_version = AtlasReleaseSchemaVersion(d.pop("schemaVersion"))

        atlas_release = cls(
            artifacts=artifacts,
            release_id=release_id,
            schema_version=schema_version,
        )

        atlas_release.additional_properties = d
        return atlas_release

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
