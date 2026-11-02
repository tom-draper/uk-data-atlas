from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T", bound="CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem"
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem:
    """
    Attributes:
        from_code (str):
        to_code (str):
        widest_difference_m (float):
    """

    from_code: str
    to_code: str
    widest_difference_m: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from_code = self.from_code

        to_code = self.to_code

        widest_difference_m = self.widest_difference_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fromCode": from_code,
                "toCode": to_code,
                "widestDifferenceM": widest_difference_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        from_code = d.pop("fromCode")

        to_code = d.pop("toCode")

        widest_difference_m = d.pop("widestDifferenceM")

        compare_boundary_releases_response_200_data_continuity_type_1_recoded_item = (
            cls(
                from_code=from_code,
                to_code=to_code,
                widest_difference_m=widest_difference_m,
            )
        )

        compare_boundary_releases_response_200_data_continuity_type_1_recoded_item.additional_properties = d
        return (
            compare_boundary_releases_response_200_data_continuity_type_1_recoded_item
        )

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
