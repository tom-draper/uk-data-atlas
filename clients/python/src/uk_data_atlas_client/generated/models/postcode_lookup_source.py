from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.postcode_lookup_source_licence import PostcodeLookupSourceLicence


T = TypeVar("T", bound="PostcodeLookupSource")


@_attrs_define
class PostcodeLookupSource:
    """
    Attributes:
        attribution (list[str]):
        edition (str):
        licence (PostcodeLookupSourceLicence):
        publisher (str):
        title (str):
    """

    attribution: list[str]
    edition: str
    licence: PostcodeLookupSourceLicence
    publisher: str
    title: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        attribution = self.attribution

        edition = self.edition

        licence = self.licence.to_dict()

        publisher = self.publisher

        title = self.title

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "attribution": attribution,
                "edition": edition,
                "licence": licence,
                "publisher": publisher,
                "title": title,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.postcode_lookup_source_licence import PostcodeLookupSourceLicence

        d = dict(src_dict)
        attribution = cast(list[str], d.pop("attribution"))

        edition = d.pop("edition")

        licence = PostcodeLookupSourceLicence.from_dict(d.pop("licence"))

        publisher = d.pop("publisher")

        title = d.pop("title")

        postcode_lookup_source = cls(
            attribution=attribution,
            edition=edition,
            licence=licence,
            publisher=publisher,
            title=title,
        )

        postcode_lookup_source.additional_properties = d
        return postcode_lookup_source

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
