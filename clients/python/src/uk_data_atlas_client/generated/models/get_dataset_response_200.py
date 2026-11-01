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
    from ..models.get_dataset_response_200_data import GetDatasetResponse200Data
    from ..models.get_dataset_response_200_meta import GetDatasetResponse200Meta


T = TypeVar("T", bound="GetDatasetResponse200")


@_attrs_define
class GetDatasetResponse200:
    """
    Attributes:
        api_version (Literal['v1']):
        atlas_release (str):
        data (GetDatasetResponse200Data):
        meta (GetDatasetResponse200Meta):
    """

    api_version: Literal["v1"]
    atlas_release: str
    data: GetDatasetResponse200Data
    meta: GetDatasetResponse200Meta
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        api_version = self.api_version

        atlas_release = self.atlas_release

        data = self.data.to_dict()

        meta = self.meta.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "apiVersion": api_version,
                "atlasRelease": atlas_release,
                "data": data,
                "meta": meta,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.get_dataset_response_200_data import GetDatasetResponse200Data
        from ..models.get_dataset_response_200_meta import GetDatasetResponse200Meta

        d = dict(src_dict)
        api_version = cast(Literal["v1"], d.pop("apiVersion"))
        if api_version != "v1":
            raise ValueError(f"apiVersion must match const 'v1', got '{api_version}'")

        atlas_release = d.pop("atlasRelease")

        data = GetDatasetResponse200Data.from_dict(d.pop("data"))

        meta = GetDatasetResponse200Meta.from_dict(d.pop("meta"))

        get_dataset_response_200 = cls(
            api_version=api_version,
            atlas_release=atlas_release,
            data=data,
            meta=meta,
        )

        get_dataset_response_200.additional_properties = d
        return get_dataset_response_200

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
