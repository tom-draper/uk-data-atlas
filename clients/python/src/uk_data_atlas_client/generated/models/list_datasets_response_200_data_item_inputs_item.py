from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ListDatasetsResponse200DataItemInputsItem")


@_attrs_define
class ListDatasetsResponse200DataItemInputsItem:
    """
    Attributes:
        bytes_ (float):
        kind (str):
        path (str):
        sha256 (str):
    """

    bytes_: float
    kind: str
    path: str
    sha256: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        bytes_ = self.bytes_

        kind = self.kind

        path = self.path

        sha256 = self.sha256

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bytes": bytes_,
                "kind": kind,
                "path": path,
                "sha256": sha256,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        bytes_ = d.pop("bytes")

        kind = d.pop("kind")

        path = d.pop("path")

        sha256 = d.pop("sha256")

        list_datasets_response_200_data_item_inputs_item = cls(
            bytes_=bytes_,
            kind=kind,
            path=path,
            sha256=sha256,
        )

        list_datasets_response_200_data_item_inputs_item.additional_properties = d
        return list_datasets_response_200_data_item_inputs_item

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
