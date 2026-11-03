from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar(
    "T", bound="CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem"
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem:
    """
    Attributes:
        code (str):
        reason (str):
    """

    code: str
    reason: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        reason = self.reason

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "reason": reason,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        reason = d.pop("reason")

        compare_boundary_releases_response_200_data_continuity_type_1_unmeasured_item = cls(
            code=code,
            reason=reason,
        )

        compare_boundary_releases_response_200_data_continuity_type_1_unmeasured_item.additional_properties = d
        return compare_boundary_releases_response_200_data_continuity_type_1_unmeasured_item

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
