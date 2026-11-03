from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.crosswalk_area import CrosswalkArea


T = TypeVar("T", bound="CrosswalkRecord")


@_attrs_define
class CrosswalkRecord:
    """
    Attributes:
        source (CrosswalkArea):
        targets (list[CrosswalkArea]):
    """

    source: CrosswalkArea
    targets: list[CrosswalkArea]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        source = self.source.to_dict()

        targets = []
        for targets_item_data in self.targets:
            targets_item = targets_item_data.to_dict()
            targets.append(targets_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "source": source,
                "targets": targets,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.crosswalk_area import CrosswalkArea

        d = dict(src_dict)
        source = CrosswalkArea.from_dict(d.pop("source"))

        targets = []
        _targets = d.pop("targets")
        for targets_item_data in _targets:
            targets_item = CrosswalkArea.from_dict(targets_item_data)

            targets.append(targets_item)

        crosswalk_record = cls(
            source=source,
            targets=targets,
        )

        crosswalk_record.additional_properties = d
        return crosswalk_record

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
