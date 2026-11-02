from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.map_resource_attribution_licence import MapResourceAttributionLicence


T = TypeVar("T", bound="MapResourceAttribution")


@_attrs_define
class MapResourceAttribution:
    """
    Attributes:
        href (str):
        licence (MapResourceAttributionLicence):
        publisher (str):
        source_url (str):
        text (str): Ready to display beside the map.
    """

    href: str
    licence: MapResourceAttributionLicence
    publisher: str
    source_url: str
    text: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        href = self.href

        licence = self.licence.to_dict()

        publisher = self.publisher

        source_url = self.source_url

        text = self.text

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "href": href,
                "licence": licence,
                "publisher": publisher,
                "sourceUrl": source_url,
                "text": text,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.map_resource_attribution_licence import (
            MapResourceAttributionLicence,
        )

        d = dict(src_dict)
        href = d.pop("href")

        licence = MapResourceAttributionLicence.from_dict(d.pop("licence"))

        publisher = d.pop("publisher")

        source_url = d.pop("sourceUrl")

        text = d.pop("text")

        map_resource_attribution = cls(
            href=href,
            licence=licence,
            publisher=publisher,
            source_url=source_url,
            text=text,
        )

        map_resource_attribution.additional_properties = d
        return map_resource_attribution

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
