from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CrosswalkMetadataProvenanceType0")


@_attrs_define
class CrosswalkMetadataProvenanceType0:
    """The one published file the code pairs are read from.

    Attributes:
        input_ (str):
        input_hash (str):
    """

    input_: str
    input_hash: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        input_ = self.input_

        input_hash = self.input_hash

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "input": input_,
                "inputHash": input_hash,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        input_ = d.pop("input")

        input_hash = d.pop("inputHash")

        crosswalk_metadata_provenance_type_0 = cls(
            input_=input_,
            input_hash=input_hash,
        )

        crosswalk_metadata_provenance_type_0.additional_properties = d
        return crosswalk_metadata_provenance_type_0

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
