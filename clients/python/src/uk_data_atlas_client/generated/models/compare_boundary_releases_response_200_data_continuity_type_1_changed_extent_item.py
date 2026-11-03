from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T", bound="CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem"
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem:
    """
    Attributes:
        code (str):
        from_share (float):
        relation (str):
        to_share (float):
        widest_difference_m (float):
    """

    code: str
    from_share: float
    relation: str
    to_share: float
    widest_difference_m: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        from_share = self.from_share

        relation = self.relation

        to_share = self.to_share

        widest_difference_m = self.widest_difference_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "fromShare": from_share,
                "relation": relation,
                "toShare": to_share,
                "widestDifferenceM": widest_difference_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        from_share = d.pop("fromShare")

        relation = d.pop("relation")

        to_share = d.pop("toShare")

        widest_difference_m = d.pop("widestDifferenceM")

        compare_boundary_releases_response_200_data_continuity_type_1_changed_extent_item = cls(
            code=code,
            from_share=from_share,
            relation=relation,
            to_share=to_share,
            widest_difference_m=widest_difference_m,
        )

        compare_boundary_releases_response_200_data_continuity_type_1_changed_extent_item.additional_properties = d
        return compare_boundary_releases_response_200_data_continuity_type_1_changed_extent_item

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
