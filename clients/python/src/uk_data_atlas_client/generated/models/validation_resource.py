from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.validation_resource_kind import ValidationResourceKind
from ..models.validation_resource_status import ValidationResourceStatus

if TYPE_CHECKING:
    from ..models.validation_check import ValidationCheck


T = TypeVar("T", bound="ValidationResource")


@_attrs_define
class ValidationResource:
    """
    Attributes:
        checks (list[ValidationCheck]):
        id (str): `atlas` for checks across the Atlas's own artifacts; otherwise the validated resource's API path, such
            as `crosswalks/{crosswalk-id}`. A measure source partition is identified by the export that serves it, as
            `exports/{export-id}`.
        kind (ValidationResourceKind):
        status (ValidationResourceStatus): waived when any of its checks is waived.
    """

    checks: list[ValidationCheck]
    id: str
    kind: ValidationResourceKind
    status: ValidationResourceStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        checks = []
        for checks_item_data in self.checks:
            checks_item = checks_item_data.to_dict()
            checks.append(checks_item)

        id = self.id

        kind = self.kind.value

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "checks": checks,
                "id": id,
                "kind": kind,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.validation_check import ValidationCheck

        d = dict(src_dict)
        checks = []
        _checks = d.pop("checks")
        for checks_item_data in _checks:
            checks_item = ValidationCheck.from_dict(checks_item_data)

            checks.append(checks_item)

        id = d.pop("id")

        kind = ValidationResourceKind(d.pop("kind"))

        status = ValidationResourceStatus(d.pop("status"))

        validation_resource = cls(
            checks=checks,
            id=id,
            kind=kind,
            status=status,
        )

        validation_resource.additional_properties = d
        return validation_resource

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
