from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.capability_status import CapabilityStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="Capability")


@_attrs_define
class Capability:
    """
    Attributes:
        status (CapabilityStatus): The one vocabulary every capability answer uses. `available`: served directly and
            completely for what was asked. `partial`: served directly for only part of it. `requires-conversion`: not served
            directly, but a published conversion path answers it, and the answer names that path. `unsupported`: nothing the
            Atlas publishes answers it. `not-built`: this deployment has not built the artifact that would say. Every status
            but `available` carries a `reason`.
        reason (str | Unset): Why the status is not `available`; present on every other status.
    """

    status: CapabilityStatus
    reason: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        reason = self.reason

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "status": status,
            }
        )
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        status = CapabilityStatus(d.pop("status"))

        reason = d.pop("reason", UNSET)

        capability = cls(
            status=status,
            reason=reason,
        )

        capability.additional_properties = d
        return capability

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
