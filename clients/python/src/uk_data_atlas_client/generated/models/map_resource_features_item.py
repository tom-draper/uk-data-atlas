from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.map_resource_features_item_format import MapResourceFeaturesItemFormat
from ..models.map_resource_features_item_tier import MapResourceFeaturesItemTier
from ..types import UNSET, Unset

T = TypeVar("T", bound="MapResourceFeaturesItem")


@_attrs_define
class MapResourceFeaturesItem:
    """
    Attributes:
        bytes_ (int):
        content_hash (str): SHA-256 of the file served at `href`, once any content encoding is undone.
        coordinates (int): Coordinates across the tier's shared arcs, each border counted once.
        format_ (MapResourceFeaturesItemFormat):
        href (str):
        row_count (int): One row per area in the release.
        tier (MapResourceFeaturesItemTier):
        tolerance_m (float):
        artifact (str | Unset): The stored file, when present. Generated downloads omit this field and use their API
            href.
        gzip_bytes (int | Unset): Present for GeoJSON: the size of its gzip encoding as sent with `Content-Encoding:
            gzip`.
    """

    bytes_: int
    content_hash: str
    coordinates: int
    format_: MapResourceFeaturesItemFormat
    href: str
    row_count: int
    tier: MapResourceFeaturesItemTier
    tolerance_m: float
    artifact: str | Unset = UNSET
    gzip_bytes: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        bytes_ = self.bytes_

        content_hash = self.content_hash

        coordinates = self.coordinates

        format_ = self.format_.value

        href = self.href

        row_count = self.row_count

        tier = self.tier.value

        tolerance_m = self.tolerance_m

        artifact = self.artifact

        gzip_bytes = self.gzip_bytes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bytes": bytes_,
                "contentHash": content_hash,
                "coordinates": coordinates,
                "format": format_,
                "href": href,
                "rowCount": row_count,
                "tier": tier,
                "toleranceM": tolerance_m,
            }
        )
        if artifact is not UNSET:
            field_dict["artifact"] = artifact
        if gzip_bytes is not UNSET:
            field_dict["gzipBytes"] = gzip_bytes

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        bytes_ = d.pop("bytes")

        content_hash = d.pop("contentHash")

        coordinates = d.pop("coordinates")

        format_ = MapResourceFeaturesItemFormat(d.pop("format"))

        href = d.pop("href")

        row_count = d.pop("rowCount")

        tier = MapResourceFeaturesItemTier(d.pop("tier"))

        tolerance_m = d.pop("toleranceM")

        artifact = d.pop("artifact", UNSET)

        gzip_bytes = d.pop("gzipBytes", UNSET)

        map_resource_features_item = cls(
            bytes_=bytes_,
            content_hash=content_hash,
            coordinates=coordinates,
            format_=format_,
            href=href,
            row_count=row_count,
            tier=tier,
            tolerance_m=tolerance_m,
            artifact=artifact,
            gzip_bytes=gzip_bytes,
        )

        map_resource_features_item.additional_properties = d
        return map_resource_features_item

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
