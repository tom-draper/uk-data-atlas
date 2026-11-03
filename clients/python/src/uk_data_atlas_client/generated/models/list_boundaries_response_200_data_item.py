from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ListBoundariesResponse200DataItem")


@_attrs_define
class ListBoundariesResponse200DataItem:
    """
    Attributes:
        id (str):
        latest_release (str):
        release_count (int):
    """

    id: str
    latest_release: str
    release_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        latest_release = self.latest_release

        release_count = self.release_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "latestRelease": latest_release,
                "releaseCount": release_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        id = d.pop("id")

        latest_release = d.pop("latestRelease")

        release_count = d.pop("releaseCount")

        list_boundaries_response_200_data_item = cls(
            id=id,
            latest_release=latest_release,
            release_count=release_count,
        )

        list_boundaries_response_200_data_item.additional_properties = d
        return list_boundaries_response_200_data_item

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
