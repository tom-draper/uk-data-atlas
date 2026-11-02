from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.boundary_release_downloads_type_1_status import (
    BoundaryReleaseDownloadsType1Status,
)

if TYPE_CHECKING:
    from ..models.download_urls import DownloadUrls


T = TypeVar("T", bound="BoundaryReleaseDownloadsType1")


@_attrs_define
class BoundaryReleaseDownloadsType1:
    """
    Attributes:
        geoparquet (DownloadUrls):
        reason (str):
        status (BoundaryReleaseDownloadsType1Status):
    """

    geoparquet: DownloadUrls
    reason: str
    status: BoundaryReleaseDownloadsType1Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geoparquet = self.geoparquet.to_dict()

        reason = self.reason

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geoparquet": geoparquet,
                "reason": reason,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.download_urls import DownloadUrls

        d = dict(src_dict)
        geoparquet = DownloadUrls.from_dict(d.pop("geoparquet"))

        reason = d.pop("reason")

        status = BoundaryReleaseDownloadsType1Status(d.pop("status"))

        boundary_release_downloads_type_1 = cls(
            geoparquet=geoparquet,
            reason=reason,
            status=status,
        )

        boundary_release_downloads_type_1.additional_properties = d
        return boundary_release_downloads_type_1

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
