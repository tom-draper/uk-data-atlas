from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaPostcodeCounts")


@_attrs_define
class AreaPostcodeCounts:
    """Unit postcode centroid counts for this area, compiled from the ONS Postcode Directory. `live` is the number with no
    termination date; `terminated` is retained historical directory records; `largeUser` is the live subset marked as
    serving a single large user. A postcode on a shared area boundary may be counted in each area it touches.

        Attributes:
            edition (str): The ONS Postcode Directory edition used for the counts.
            large_user (int):
            live (int):
            terminated (int):
    """

    edition: str
    large_user: int
    live: int
    terminated: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        edition = self.edition

        large_user = self.large_user

        live = self.live

        terminated = self.terminated

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "edition": edition,
                "largeUser": large_user,
                "live": live,
                "terminated": terminated,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        edition = d.pop("edition")

        large_user = d.pop("largeUser")

        live = d.pop("live")

        terminated = d.pop("terminated")

        area_postcode_counts = cls(
            edition=edition,
            large_user=large_user,
            live=live,
            terminated=terminated,
        )

        area_postcode_counts.additional_properties = d
        return area_postcode_counts

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
