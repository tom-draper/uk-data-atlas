from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PointContainmentPostcodeSource")


@_attrs_define
class PointContainmentPostcodeSource:
    """
    Attributes:
        attribution (str | Unset):
        edition (str | Unset):
        licence (Any | Unset):
        publisher (str | Unset):
        title (str | Unset):
    """

    attribution: str | Unset = UNSET
    edition: str | Unset = UNSET
    licence: Any | Unset = UNSET
    publisher: str | Unset = UNSET
    title: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        attribution = self.attribution

        edition = self.edition

        licence = self.licence

        publisher = self.publisher

        title = self.title

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if attribution is not UNSET:
            field_dict["attribution"] = attribution
        if edition is not UNSET:
            field_dict["edition"] = edition
        if licence is not UNSET:
            field_dict["licence"] = licence
        if publisher is not UNSET:
            field_dict["publisher"] = publisher
        if title is not UNSET:
            field_dict["title"] = title

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        attribution = d.pop("attribution", UNSET)

        edition = d.pop("edition", UNSET)

        licence = d.pop("licence", UNSET)

        publisher = d.pop("publisher", UNSET)

        title = d.pop("title", UNSET)

        point_containment_postcode_source = cls(
            attribution=attribution,
            edition=edition,
            licence=licence,
            publisher=publisher,
            title=title,
        )

        point_containment_postcode_source.additional_properties = d
        return point_containment_postcode_source

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
