from __future__ import annotations

from collections.abc import Mapping
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Self,
    TypeVar,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.get_boundary_release_response_200_data_downloads_type_1_geoparquet import (
        GetBoundaryReleaseResponse200DataDownloadsType1Geoparquet,
    )


T = TypeVar("T", bound="GetBoundaryReleaseResponse200DataDownloadsType1")


@_attrs_define
class GetBoundaryReleaseResponse200DataDownloadsType1:
    """
    Attributes:
        geoparquet (GetBoundaryReleaseResponse200DataDownloadsType1Geoparquet): GeoParquet downloads by tier.
        reason (str):
        status (Literal['untiled']):
    """

    geoparquet: GetBoundaryReleaseResponse200DataDownloadsType1Geoparquet
    reason: str
    status: Literal["untiled"]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geoparquet = self.geoparquet.to_dict()

        reason = self.reason

        status = self.status

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
        from ..models.get_boundary_release_response_200_data_downloads_type_1_geoparquet import (
            GetBoundaryReleaseResponse200DataDownloadsType1Geoparquet,
        )

        d = dict(src_dict)
        geoparquet = (
            GetBoundaryReleaseResponse200DataDownloadsType1Geoparquet.from_dict(
                d.pop("geoparquet")
            )
        )

        reason = d.pop("reason")

        status = cast(Literal["untiled"], d.pop("status"))
        if status != "untiled":
            raise ValueError(f"status must match const 'untiled', got '{status}'")

        get_boundary_release_response_200_data_downloads_type_1 = cls(
            geoparquet=geoparquet,
            reason=reason,
            status=status,
        )

        get_boundary_release_response_200_data_downloads_type_1.additional_properties = d
        return get_boundary_release_response_200_data_downloads_type_1

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
