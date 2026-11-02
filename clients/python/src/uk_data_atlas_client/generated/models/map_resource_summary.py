from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="MapResourceSummary")


@_attrs_define
class MapResourceSummary:
    """
    Attributes:
        boundary_release (str):
        geography (str):
        href (str):
        id (str): The boundary release identity, `{geography}/{release}`.
        title (str):
    """

    boundary_release: str
    geography: str
    href: str
    id: str
    title: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        geography = self.geography

        href = self.href

        id = self.id

        title = self.title

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "geography": geography,
                "href": href,
                "id": id,
                "title": title,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        geography = d.pop("geography")

        href = d.pop("href")

        id = d.pop("id")

        title = d.pop("title")

        map_resource_summary = cls(
            boundary_release=boundary_release,
            geography=geography,
            href=href,
            id=id,
            title=title,
        )

        map_resource_summary.additional_properties = d
        return map_resource_summary

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
