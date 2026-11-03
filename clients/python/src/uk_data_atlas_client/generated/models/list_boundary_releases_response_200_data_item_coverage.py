from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ListBoundaryReleasesResponse200DataItemCoverage")


@_attrs_define
class ListBoundaryReleasesResponse200DataItemCoverage:
    """
    Attributes:
        countries (list[str]):
    """

    countries: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        countries = self.countries

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "countries": countries,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        countries = cast(list[str], d.pop("countries"))

        list_boundary_releases_response_200_data_item_coverage = cls(
            countries=countries,
        )

        list_boundary_releases_response_200_data_item_coverage.additional_properties = d
        return list_boundary_releases_response_200_data_item_coverage

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
