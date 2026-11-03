from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_measures_response_200_data_item_dimensions_item_members_item import (
        ListMeasuresResponse200DataItemDimensionsItemMembersItem,
    )


T = TypeVar("T", bound="ListMeasuresResponse200DataItemDimensionsItem")


@_attrs_define
class ListMeasuresResponse200DataItemDimensionsItem:
    """
    Attributes:
        id (str):
        label (str):
        members (list[ListMeasuresResponse200DataItemDimensionsItemMembersItem]):
        total (str | Unset):
    """

    id: str
    label: str
    members: list[ListMeasuresResponse200DataItemDimensionsItemMembersItem]
    total: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        label = self.label

        members = []
        for members_item_data in self.members:
            members_item = members_item_data.to_dict()
            members.append(members_item)

        total = self.total

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "label": label,
                "members": members,
            }
        )
        if total is not UNSET:
            field_dict["total"] = total

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_measures_response_200_data_item_dimensions_item_members_item import (
            ListMeasuresResponse200DataItemDimensionsItemMembersItem,  # noqa: PLC0415
        )

        d = dict(src_dict)
        id = d.pop("id")

        label = d.pop("label")

        members = []
        _members = d.pop("members")
        for members_item_data in _members:
            members_item = (
                ListMeasuresResponse200DataItemDimensionsItemMembersItem.from_dict(
                    members_item_data
                )
            )

            members.append(members_item)

        total = d.pop("total", UNSET)

        list_measures_response_200_data_item_dimensions_item = cls(
            id=id,
            label=label,
            members=members,
            total=total,
        )

        list_measures_response_200_data_item_dimensions_item.additional_properties = d
        return list_measures_response_200_data_item_dimensions_item

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
