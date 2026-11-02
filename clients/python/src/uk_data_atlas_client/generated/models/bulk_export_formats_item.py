from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.bulk_export_formats_item_format import BulkExportFormatsItemFormat
from ..types import UNSET, Unset

T = TypeVar("T", bound="BulkExportFormatsItem")


@_attrs_define
class BulkExportFormatsItem:
    """
    Attributes:
        artifact (str):
        bytes_ (int):
        content_hash (str):
        format_ (BulkExportFormatsItemFormat):
        href (str):
        gzip_bytes (int | Unset): Present when the file is stored gzipped, as CSV is: its size as sent with `Content-
            Encoding: gzip`. A stored-gzipped file is not served in byte ranges.
    """

    artifact: str
    bytes_: int
    content_hash: str
    format_: BulkExportFormatsItemFormat
    href: str
    gzip_bytes: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        artifact = self.artifact

        bytes_ = self.bytes_

        content_hash = self.content_hash

        format_ = self.format_.value

        href = self.href

        gzip_bytes = self.gzip_bytes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "artifact": artifact,
                "bytes": bytes_,
                "contentHash": content_hash,
                "format": format_,
                "href": href,
            }
        )
        if gzip_bytes is not UNSET:
            field_dict["gzipBytes"] = gzip_bytes

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        artifact = d.pop("artifact")

        bytes_ = d.pop("bytes")

        content_hash = d.pop("contentHash")

        format_ = BulkExportFormatsItemFormat(d.pop("format"))

        href = d.pop("href")

        gzip_bytes = d.pop("gzipBytes", UNSET)

        bulk_export_formats_item = cls(
            artifact=artifact,
            bytes_=bytes_,
            content_hash=content_hash,
            format_=format_,
            href=href,
            gzip_bytes=gzip_bytes,
        )

        bulk_export_formats_item.additional_properties = d
        return bulk_export_formats_item

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
