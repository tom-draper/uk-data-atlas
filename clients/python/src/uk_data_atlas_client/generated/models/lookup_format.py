from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="LookupFormat")


@_attrs_define
class LookupFormat:
    """
    Attributes:
        bytes_ (int):
        content_hash (str): SHA-256 of the rendered bytes, which a download is checked against.
        content_type (str):
        href (str):
    """

    bytes_: int
    content_hash: str
    content_type: str
    href: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        bytes_ = self.bytes_

        content_hash = self.content_hash

        content_type = self.content_type

        href = self.href

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bytes": bytes_,
                "contentHash": content_hash,
                "contentType": content_type,
                "href": href,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        bytes_ = d.pop("bytes")

        content_hash = d.pop("contentHash")

        content_type = d.pop("contentType")

        href = d.pop("href")

        lookup_format = cls(
            bytes_=bytes_,
            content_hash=content_hash,
            content_type=content_type,
            href=href,
        )

        lookup_format.additional_properties = d
        return lookup_format

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
