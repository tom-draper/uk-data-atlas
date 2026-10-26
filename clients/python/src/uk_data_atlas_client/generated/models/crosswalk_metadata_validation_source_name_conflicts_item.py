from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CrosswalkMetadataValidationSourceNameConflictsItem")


@_attrs_define
class CrosswalkMetadataValidationSourceNameConflictsItem:
    """
    Attributes:
        code (str):
        names (list[str]):
    """

    code: str
    names: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        names = self.names

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "names": names,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        names = cast(list[str], d.pop("names"))

        crosswalk_metadata_validation_source_name_conflicts_item = cls(
            code=code,
            names=names,
        )

        crosswalk_metadata_validation_source_name_conflicts_item.additional_properties = d
        return crosswalk_metadata_validation_source_name_conflicts_item

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
