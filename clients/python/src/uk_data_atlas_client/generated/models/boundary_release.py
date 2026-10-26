from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.boundary_release_coverage import BoundaryReleaseCoverage
    from ..models.boundary_release_source import BoundaryReleaseSource


T = TypeVar("T", bound="BoundaryRelease")


@_attrs_define
class BoundaryRelease:
    """
    Attributes:
        coverage (BoundaryReleaseCoverage):
        geography (str):
        id (str):
        metadata_hash (str):
        source (BoundaryReleaseSource):
        title (str):
        description (str | Unset):
        temporal_coverage (str | Unset):
    """

    coverage: BoundaryReleaseCoverage
    geography: str
    id: str
    metadata_hash: str
    source: BoundaryReleaseSource
    title: str
    description: str | Unset = UNSET
    temporal_coverage: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        coverage = self.coverage.to_dict()

        geography = self.geography

        id = self.id

        metadata_hash = self.metadata_hash

        source = self.source.to_dict()

        title = self.title

        description = self.description

        temporal_coverage = self.temporal_coverage

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "coverage": coverage,
                "geography": geography,
                "id": id,
                "metadataHash": metadata_hash,
                "source": source,
                "title": title,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if temporal_coverage is not UNSET:
            field_dict["temporalCoverage"] = temporal_coverage

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.boundary_release_coverage import BoundaryReleaseCoverage
        from ..models.boundary_release_source import BoundaryReleaseSource

        d = dict(src_dict)
        coverage = BoundaryReleaseCoverage.from_dict(d.pop("coverage"))

        geography = d.pop("geography")

        id = d.pop("id")

        metadata_hash = d.pop("metadataHash")

        source = BoundaryReleaseSource.from_dict(d.pop("source"))

        title = d.pop("title")

        description = d.pop("description", UNSET)

        temporal_coverage = d.pop("temporalCoverage", UNSET)

        boundary_release = cls(
            coverage=coverage,
            geography=geography,
            id=id,
            metadata_hash=metadata_hash,
            source=source,
            title=title,
            description=description,
            temporal_coverage=temporal_coverage,
        )

        boundary_release.additional_properties = d
        return boundary_release

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
