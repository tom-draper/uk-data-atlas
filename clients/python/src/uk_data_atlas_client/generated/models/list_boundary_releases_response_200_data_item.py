from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_boundary_releases_response_200_data_item_coverage import (
        ListBoundaryReleasesResponse200DataItemCoverage,
    )
    from ..models.list_boundary_releases_response_200_data_item_deprecation import (
        ListBoundaryReleasesResponse200DataItemDeprecation,
    )
    from ..models.list_boundary_releases_response_200_data_item_source import (
        ListBoundaryReleasesResponse200DataItemSource,
    )


T = TypeVar("T", bound="ListBoundaryReleasesResponse200DataItem")


@_attrs_define
class ListBoundaryReleasesResponse200DataItem:
    """
    Attributes:
        coverage (ListBoundaryReleasesResponse200DataItemCoverage):
        geography (str):
        id (str):
        metadata_hash (str):
        source (ListBoundaryReleasesResponse200DataItemSource):
        title (str):
        deprecation (ListBoundaryReleasesResponse200DataItemDeprecation | Unset): Present on a release that has been
            superseded. The release stays published and is not chosen by date or `latest` while its replacement covers the
            date; clients should move to `replacedBy` before `sunset`.
        description (str | Unset):
        temporal_coverage (str | Unset):
    """

    coverage: ListBoundaryReleasesResponse200DataItemCoverage
    geography: str
    id: str
    metadata_hash: str
    source: ListBoundaryReleasesResponse200DataItemSource
    title: str
    deprecation: ListBoundaryReleasesResponse200DataItemDeprecation | Unset = UNSET
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

        deprecation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.deprecation, Unset):
            deprecation = self.deprecation.to_dict()

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
        if deprecation is not UNSET:
            field_dict["deprecation"] = deprecation
        if description is not UNSET:
            field_dict["description"] = description
        if temporal_coverage is not UNSET:
            field_dict["temporalCoverage"] = temporal_coverage

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.list_boundary_releases_response_200_data_item_coverage import (
            ListBoundaryReleasesResponse200DataItemCoverage,
        )
        from ..models.list_boundary_releases_response_200_data_item_deprecation import (
            ListBoundaryReleasesResponse200DataItemDeprecation,
        )
        from ..models.list_boundary_releases_response_200_data_item_source import (
            ListBoundaryReleasesResponse200DataItemSource,
        )

        d = dict(src_dict)
        coverage = ListBoundaryReleasesResponse200DataItemCoverage.from_dict(
            d.pop("coverage")
        )

        geography = d.pop("geography")

        id = d.pop("id")

        metadata_hash = d.pop("metadataHash")

        source = ListBoundaryReleasesResponse200DataItemSource.from_dict(
            d.pop("source")
        )

        title = d.pop("title")

        _deprecation = d.pop("deprecation", UNSET)
        deprecation: ListBoundaryReleasesResponse200DataItemDeprecation | Unset
        if isinstance(_deprecation, Unset):
            deprecation = UNSET
        else:
            deprecation = ListBoundaryReleasesResponse200DataItemDeprecation.from_dict(
                _deprecation
            )

        description = d.pop("description", UNSET)

        temporal_coverage = d.pop("temporalCoverage", UNSET)

        list_boundary_releases_response_200_data_item = cls(
            coverage=coverage,
            geography=geography,
            id=id,
            metadata_hash=metadata_hash,
            source=source,
            title=title,
            deprecation=deprecation,
            description=description,
            temporal_coverage=temporal_coverage,
        )

        list_boundary_releases_response_200_data_item.additional_properties = d
        return list_boundary_releases_response_200_data_item

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
