from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_codes_only_in_from_item import (
        CompareBoundaryReleasesResponse200DataCodesOnlyInFromItem,
    )
    from ..models.compare_boundary_releases_response_200_data_codes_only_in_to_item import (
        CompareBoundaryReleasesResponse200DataCodesOnlyInToItem,
    )


T = TypeVar("T", bound="CompareBoundaryReleasesResponse200DataCodes")


@_attrs_define
class CompareBoundaryReleasesResponse200DataCodes:
    """
    Attributes:
        only_in_from (list[CompareBoundaryReleasesResponse200DataCodesOnlyInFromItem]):
        only_in_to (list[CompareBoundaryReleasesResponse200DataCodesOnlyInToItem]):
    """

    only_in_from: list[CompareBoundaryReleasesResponse200DataCodesOnlyInFromItem]
    only_in_to: list[CompareBoundaryReleasesResponse200DataCodesOnlyInToItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        only_in_from = []
        for only_in_from_item_data in self.only_in_from:
            only_in_from_item = only_in_from_item_data.to_dict()
            only_in_from.append(only_in_from_item)

        only_in_to = []
        for only_in_to_item_data in self.only_in_to:
            only_in_to_item = only_in_to_item_data.to_dict()
            only_in_to.append(only_in_to_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "onlyInFrom": only_in_from,
                "onlyInTo": only_in_to,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compare_boundary_releases_response_200_data_codes_only_in_from_item import (
            CompareBoundaryReleasesResponse200DataCodesOnlyInFromItem,
        )
        from ..models.compare_boundary_releases_response_200_data_codes_only_in_to_item import (
            CompareBoundaryReleasesResponse200DataCodesOnlyInToItem,
        )

        d = dict(src_dict)
        only_in_from = []
        _only_in_from = d.pop("onlyInFrom")
        for only_in_from_item_data in _only_in_from:
            only_in_from_item = (
                CompareBoundaryReleasesResponse200DataCodesOnlyInFromItem.from_dict(
                    only_in_from_item_data
                )
            )

            only_in_from.append(only_in_from_item)

        only_in_to = []
        _only_in_to = d.pop("onlyInTo")
        for only_in_to_item_data in _only_in_to:
            only_in_to_item = (
                CompareBoundaryReleasesResponse200DataCodesOnlyInToItem.from_dict(
                    only_in_to_item_data
                )
            )

            only_in_to.append(only_in_to_item)

        compare_boundary_releases_response_200_data_codes = cls(
            only_in_from=only_in_from,
            only_in_to=only_in_to,
        )

        compare_boundary_releases_response_200_data_codes.additional_properties = d
        return compare_boundary_releases_response_200_data_codes

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
