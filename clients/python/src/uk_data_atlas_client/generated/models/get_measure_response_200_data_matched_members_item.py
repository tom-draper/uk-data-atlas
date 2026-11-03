from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetMeasureResponse200DataMatchedMembersItem")


@_attrs_define
class GetMeasureResponse200DataMatchedMembersItem:
    """
    Attributes:
        dimension (str):
        href (str):
        label (str):
        member (str):
    """

    dimension: str
    href: str
    label: str
    member: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        dimension = self.dimension

        href = self.href

        label = self.label

        member = self.member

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dimension": dimension,
                "href": href,
                "label": label,
                "member": member,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        dimension = d.pop("dimension")

        href = d.pop("href")

        label = d.pop("label")

        member = d.pop("member")

        get_measure_response_200_data_matched_members_item = cls(
            dimension=dimension,
            href=href,
            label=label,
            member=member,
        )

        get_measure_response_200_data_matched_members_item.additional_properties = d
        return get_measure_response_200_data_matched_members_item

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
