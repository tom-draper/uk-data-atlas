from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.problem_rejected_item_validation import ProblemRejectedItemValidation


T = TypeVar("T", bound="ProblemRejectedItem")


@_attrs_define
class ProblemRejectedItem:
    """
    Attributes:
        area (str):
        index (int):
        reason (str):
        validation (ProblemRejectedItemValidation):
    """

    area: str
    index: int
    reason: str
    validation: ProblemRejectedItemValidation
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area = self.area

        index = self.index

        reason = self.reason

        validation = self.validation.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "area": area,
                "index": index,
                "reason": reason,
                "validation": validation,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.problem_rejected_item_validation import (
            ProblemRejectedItemValidation,
        )

        d = dict(src_dict)
        area = d.pop("area")

        index = d.pop("index")

        reason = d.pop("reason")

        validation = ProblemRejectedItemValidation.from_dict(d.pop("validation"))

        problem_rejected_item = cls(
            area=area,
            index=index,
            reason=reason,
            validation=validation,
        )

        problem_rejected_item.additional_properties = d
        return problem_rejected_item

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
