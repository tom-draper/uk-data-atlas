from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_relationship import AreaRelationship
    from ..models.area_with_relationships_child_selection_type_0 import (
        AreaWithRelationshipsChildSelectionType0,
    )
    from ..models.area_with_relationships_child_selection_type_1 import (
        AreaWithRelationshipsChildSelectionType1,
    )


T = TypeVar("T", bound="AreaWithRelationships")


@_attrs_define
class AreaWithRelationships:
    """
    Attributes:
        boundary_release (str):
        code (str):
        geography (str):
        id (str):
        name (str):
        relationships (list[AreaRelationship]):
        aliases (list[str] | Unset):
        child_selection (AreaWithRelationshipsChildSelectionType0 | AreaWithRelationshipsChildSelectionType1 | Unset):
            Present on the children route. `contemporary` selects the child release current at the parent's release month;
            `release` records an exact child geography/release filter.
    """

    boundary_release: str
    code: str
    geography: str
    id: str
    name: str
    relationships: list[AreaRelationship]
    aliases: list[str] | Unset = UNSET
    child_selection: (
        AreaWithRelationshipsChildSelectionType0
        | AreaWithRelationshipsChildSelectionType1
        | Unset
    ) = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.area_with_relationships_child_selection_type_0 import (
            AreaWithRelationshipsChildSelectionType0,
        )

        boundary_release = self.boundary_release

        code = self.code

        geography = self.geography

        id = self.id

        name = self.name

        relationships = []
        for relationships_item_data in self.relationships:
            relationships_item = relationships_item_data.to_dict()
            relationships.append(relationships_item)

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        child_selection: dict[str, Any] | Unset
        if isinstance(self.child_selection, Unset):
            child_selection = UNSET
        elif isinstance(self.child_selection, AreaWithRelationshipsChildSelectionType0):
            child_selection = self.child_selection.to_dict()
        else:
            child_selection = self.child_selection.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "code": code,
                "geography": geography,
                "id": id,
                "name": name,
                "relationships": relationships,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if child_selection is not UNSET:
            field_dict["childSelection"] = child_selection

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_relationship import AreaRelationship
        from ..models.area_with_relationships_child_selection_type_0 import (
            AreaWithRelationshipsChildSelectionType0,
        )
        from ..models.area_with_relationships_child_selection_type_1 import (
            AreaWithRelationshipsChildSelectionType1,
        )

        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        code = d.pop("code")

        geography = d.pop("geography")

        id = d.pop("id")

        name = d.pop("name")

        relationships = []
        _relationships = d.pop("relationships")
        for relationships_item_data in _relationships:
            relationships_item = AreaRelationship.from_dict(relationships_item_data)

            relationships.append(relationships_item)

        aliases = cast(list[str], d.pop("aliases", UNSET))

        def _parse_child_selection(
            data: object,
        ) -> (
            AreaWithRelationshipsChildSelectionType0
            | AreaWithRelationshipsChildSelectionType1
            | Unset
        ):
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                child_selection_type_0 = (
                    AreaWithRelationshipsChildSelectionType0.from_dict(data)
                )

                return child_selection_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            child_selection_type_1 = AreaWithRelationshipsChildSelectionType1.from_dict(
                data
            )

            return child_selection_type_1

        child_selection = _parse_child_selection(d.pop("childSelection", UNSET))

        area_with_relationships = cls(
            boundary_release=boundary_release,
            code=code,
            geography=geography,
            id=id,
            name=name,
            relationships=relationships,
            aliases=aliases,
            child_selection=child_selection,
        )

        area_with_relationships.additional_properties = d
        return area_with_relationships

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
