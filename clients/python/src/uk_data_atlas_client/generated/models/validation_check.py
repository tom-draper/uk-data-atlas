from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.validation_check_id import ValidationCheckId
from ..models.validation_check_status import ValidationCheckStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.validation_check_measured import ValidationCheckMeasured
    from ..models.validation_check_waiver import ValidationCheckWaiver


T = TypeVar("T", bound="ValidationCheck")


@_attrs_define
class ValidationCheck:
    """
    Attributes:
        id (ValidationCheckId):
        status (ValidationCheckStatus):
        detail (str | Unset): What the check found. Present on every waived check.
        measured (ValidationCheckMeasured | Unset): Figures the check measured, whether it passed or not.
        waiver (ValidationCheckWaiver | Unset):
    """

    id: ValidationCheckId
    status: ValidationCheckStatus
    detail: str | Unset = UNSET
    measured: ValidationCheckMeasured | Unset = UNSET
    waiver: ValidationCheckWaiver | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id.value

        status = self.status.value

        detail = self.detail

        measured: dict[str, Any] | Unset = UNSET
        if not isinstance(self.measured, Unset):
            measured = self.measured.to_dict()

        waiver: dict[str, Any] | Unset = UNSET
        if not isinstance(self.waiver, Unset):
            waiver = self.waiver.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "status": status,
            }
        )
        if detail is not UNSET:
            field_dict["detail"] = detail
        if measured is not UNSET:
            field_dict["measured"] = measured
        if waiver is not UNSET:
            field_dict["waiver"] = waiver

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.validation_check_measured import ValidationCheckMeasured
        from ..models.validation_check_waiver import ValidationCheckWaiver

        d = dict(src_dict)
        id = ValidationCheckId(d.pop("id"))

        status = ValidationCheckStatus(d.pop("status"))

        detail = d.pop("detail", UNSET)

        _measured = d.pop("measured", UNSET)
        measured: ValidationCheckMeasured | Unset
        if isinstance(_measured, Unset):
            measured = UNSET
        else:
            measured = ValidationCheckMeasured.from_dict(_measured)

        _waiver = d.pop("waiver", UNSET)
        waiver: ValidationCheckWaiver | Unset
        if isinstance(_waiver, Unset):
            waiver = UNSET
        else:
            waiver = ValidationCheckWaiver.from_dict(_waiver)

        validation_check = cls(
            id=id,
            status=status,
            detail=detail,
            measured=measured,
            waiver=waiver,
        )

        validation_check.additional_properties = d
        return validation_check

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
