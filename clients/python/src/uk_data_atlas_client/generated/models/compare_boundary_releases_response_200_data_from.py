from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CompareBoundaryReleasesResponse200DataFrom")


@_attrs_define
class CompareBoundaryReleasesResponse200DataFrom:
    """
    Attributes:
        boundary_release (str):
        geography (str):
    """

    boundary_release: str
    geography: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        geography = self.geography

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "geography": geography,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        geography = d.pop("geography")

        compare_boundary_releases_response_200_data_from = cls(
            boundary_release=boundary_release,
            geography=geography,
        )

        compare_boundary_releases_response_200_data_from.additional_properties = d
        return compare_boundary_releases_response_200_data_from

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
