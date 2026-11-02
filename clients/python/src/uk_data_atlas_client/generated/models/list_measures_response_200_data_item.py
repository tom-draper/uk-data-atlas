from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.list_measures_response_200_data_item_value_kind import (
    ListMeasuresResponse200DataItemValueKind,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_measures_response_200_data_item_aggregation import (
        ListMeasuresResponse200DataItemAggregation,
    )
    from ..models.list_measures_response_200_data_item_availability import (
        ListMeasuresResponse200DataItemAvailability,
    )
    from ..models.list_measures_response_200_data_item_defaults import (
        ListMeasuresResponse200DataItemDefaults,
    )
    from ..models.list_measures_response_200_data_item_derived_from import (
        ListMeasuresResponse200DataItemDerivedFrom,
    )
    from ..models.list_measures_response_200_data_item_dimensions_item import (
        ListMeasuresResponse200DataItemDimensionsItem,
    )
    from ..models.list_measures_response_200_data_item_documents import (
        ListMeasuresResponse200DataItemDocuments,
    )
    from ..models.list_measures_response_200_data_item_elsewhere_item import (
        ListMeasuresResponse200DataItemElsewhereItem,
    )
    from ..models.list_measures_response_200_data_item_links import (
        ListMeasuresResponse200DataItemLinks,
    )
    from ..models.list_measures_response_200_data_item_matched_members_item import (
        ListMeasuresResponse200DataItemMatchedMembersItem,
    )
    from ..models.list_measures_response_200_data_item_resolved_from import (
        ListMeasuresResponse200DataItemResolvedFrom,
    )
    from ..models.list_measures_response_200_data_item_series_item import (
        ListMeasuresResponse200DataItemSeriesItem,
    )
    from ..models.list_measures_response_200_data_item_sources_item import (
        ListMeasuresResponse200DataItemSourcesItem,
    )
    from ..models.list_measures_response_200_data_item_uncertainty import (
        ListMeasuresResponse200DataItemUncertainty,
    )
    from ..models.list_measures_response_200_data_item_unit_definition import (
        ListMeasuresResponse200DataItemUnitDefinition,
    )


T = TypeVar("T", bound="ListMeasuresResponse200DataItem")


@_attrs_define
class ListMeasuresResponse200DataItem:
    """
    Attributes:
        aggregation (ListMeasuresResponse200DataItemAggregation):
        availability (ListMeasuresResponse200DataItemAvailability):
        description (str):
        dimensions (list[ListMeasuresResponse200DataItemDimensionsItem]):
        id (str):
        label (str):
        links (ListMeasuresResponse200DataItemLinks):
        series (list[ListMeasuresResponse200DataItemSeriesItem]):
        sources (list[ListMeasuresResponse200DataItemSourcesItem]):
        unit (str):
        value_kind (ListMeasuresResponse200DataItemValueKind):
        aliases (list[str] | Unset):
        concept (str | Unset):
        defaults (ListMeasuresResponse200DataItemDefaults | Unset):
        derived_from (ListMeasuresResponse200DataItemDerivedFrom | Unset):
        documents (ListMeasuresResponse200DataItemDocuments | Unset):
        elsewhere (list[ListMeasuresResponse200DataItemElsewhereItem] | Unset):
        matched_members (list[ListMeasuresResponse200DataItemMatchedMembersItem] | Unset):
        notes (list[str] | Unset):
        resolved_from (ListMeasuresResponse200DataItemResolvedFrom | Unset):
        uncertainty (ListMeasuresResponse200DataItemUncertainty | Unset):
        unit_definition (ListMeasuresResponse200DataItemUnitDefinition | Unset):
    """

    aggregation: ListMeasuresResponse200DataItemAggregation
    availability: ListMeasuresResponse200DataItemAvailability
    description: str
    dimensions: list[ListMeasuresResponse200DataItemDimensionsItem]
    id: str
    label: str
    links: ListMeasuresResponse200DataItemLinks
    series: list[ListMeasuresResponse200DataItemSeriesItem]
    sources: list[ListMeasuresResponse200DataItemSourcesItem]
    unit: str
    value_kind: ListMeasuresResponse200DataItemValueKind
    aliases: list[str] | Unset = UNSET
    concept: str | Unset = UNSET
    defaults: ListMeasuresResponse200DataItemDefaults | Unset = UNSET
    derived_from: ListMeasuresResponse200DataItemDerivedFrom | Unset = UNSET
    documents: ListMeasuresResponse200DataItemDocuments | Unset = UNSET
    elsewhere: list[ListMeasuresResponse200DataItemElsewhereItem] | Unset = UNSET
    matched_members: list[ListMeasuresResponse200DataItemMatchedMembersItem] | Unset = (
        UNSET
    )
    notes: list[str] | Unset = UNSET
    resolved_from: ListMeasuresResponse200DataItemResolvedFrom | Unset = UNSET
    uncertainty: ListMeasuresResponse200DataItemUncertainty | Unset = UNSET
    unit_definition: ListMeasuresResponse200DataItemUnitDefinition | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        aggregation = self.aggregation.to_dict()

        availability = self.availability.to_dict()

        description = self.description

        dimensions = []
        for dimensions_item_data in self.dimensions:
            dimensions_item = dimensions_item_data.to_dict()
            dimensions.append(dimensions_item)

        id = self.id

        label = self.label

        links = self.links.to_dict()

        series = []
        for series_item_data in self.series:
            series_item = series_item_data.to_dict()
            series.append(series_item)

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)

        unit = self.unit

        value_kind = self.value_kind.value

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        concept = self.concept

        defaults: dict[str, Any] | Unset = UNSET
        if not isinstance(self.defaults, Unset):
            defaults = self.defaults.to_dict()

        derived_from: dict[str, Any] | Unset = UNSET
        if not isinstance(self.derived_from, Unset):
            derived_from = self.derived_from.to_dict()

        documents: dict[str, Any] | Unset = UNSET
        if not isinstance(self.documents, Unset):
            documents = self.documents.to_dict()

        elsewhere: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.elsewhere, Unset):
            elsewhere = []
            for elsewhere_item_data in self.elsewhere:
                elsewhere_item = elsewhere_item_data.to_dict()
                elsewhere.append(elsewhere_item)

        matched_members: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.matched_members, Unset):
            matched_members = []
            for matched_members_item_data in self.matched_members:
                matched_members_item = matched_members_item_data.to_dict()
                matched_members.append(matched_members_item)

        notes: list[str] | Unset = UNSET
        if not isinstance(self.notes, Unset):
            notes = self.notes

        resolved_from: dict[str, Any] | Unset = UNSET
        if not isinstance(self.resolved_from, Unset):
            resolved_from = self.resolved_from.to_dict()

        uncertainty: dict[str, Any] | Unset = UNSET
        if not isinstance(self.uncertainty, Unset):
            uncertainty = self.uncertainty.to_dict()

        unit_definition: dict[str, Any] | Unset = UNSET
        if not isinstance(self.unit_definition, Unset):
            unit_definition = self.unit_definition.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aggregation": aggregation,
                "availability": availability,
                "description": description,
                "dimensions": dimensions,
                "id": id,
                "label": label,
                "links": links,
                "series": series,
                "sources": sources,
                "unit": unit,
                "valueKind": value_kind,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if concept is not UNSET:
            field_dict["concept"] = concept
        if defaults is not UNSET:
            field_dict["defaults"] = defaults
        if derived_from is not UNSET:
            field_dict["derivedFrom"] = derived_from
        if documents is not UNSET:
            field_dict["documents"] = documents
        if elsewhere is not UNSET:
            field_dict["elsewhere"] = elsewhere
        if matched_members is not UNSET:
            field_dict["matchedMembers"] = matched_members
        if notes is not UNSET:
            field_dict["notes"] = notes
        if resolved_from is not UNSET:
            field_dict["resolvedFrom"] = resolved_from
        if uncertainty is not UNSET:
            field_dict["uncertainty"] = uncertainty
        if unit_definition is not UNSET:
            field_dict["unitDefinition"] = unit_definition

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_measures_response_200_data_item_aggregation import (
            ListMeasuresResponse200DataItemAggregation,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_availability import (
            ListMeasuresResponse200DataItemAvailability,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_defaults import (
            ListMeasuresResponse200DataItemDefaults,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_derived_from import (
            ListMeasuresResponse200DataItemDerivedFrom,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_dimensions_item import (
            ListMeasuresResponse200DataItemDimensionsItem,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_documents import (
            ListMeasuresResponse200DataItemDocuments,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_elsewhere_item import (
            ListMeasuresResponse200DataItemElsewhereItem,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_links import (
            ListMeasuresResponse200DataItemLinks,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_matched_members_item import (
            ListMeasuresResponse200DataItemMatchedMembersItem,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_resolved_from import (
            ListMeasuresResponse200DataItemResolvedFrom,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_series_item import (
            ListMeasuresResponse200DataItemSeriesItem,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_sources_item import (
            ListMeasuresResponse200DataItemSourcesItem,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_uncertainty import (
            ListMeasuresResponse200DataItemUncertainty,  # noqa: PLC0415
        )
        from ..models.list_measures_response_200_data_item_unit_definition import (
            ListMeasuresResponse200DataItemUnitDefinition,  # noqa: PLC0415
        )

        d = dict(src_dict)
        aggregation = ListMeasuresResponse200DataItemAggregation.from_dict(
            d.pop("aggregation")
        )

        availability = ListMeasuresResponse200DataItemAvailability.from_dict(
            d.pop("availability")
        )

        description = d.pop("description")

        dimensions = []
        _dimensions = d.pop("dimensions")
        for dimensions_item_data in _dimensions:
            dimensions_item = ListMeasuresResponse200DataItemDimensionsItem.from_dict(
                dimensions_item_data
            )

            dimensions.append(dimensions_item)

        id = d.pop("id")

        label = d.pop("label")

        links = ListMeasuresResponse200DataItemLinks.from_dict(d.pop("links"))

        series = []
        _series = d.pop("series")
        for series_item_data in _series:
            series_item = ListMeasuresResponse200DataItemSeriesItem.from_dict(
                series_item_data
            )

            series.append(series_item)

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in _sources:
            sources_item = ListMeasuresResponse200DataItemSourcesItem.from_dict(
                sources_item_data
            )

            sources.append(sources_item)

        unit = d.pop("unit")

        value_kind = ListMeasuresResponse200DataItemValueKind(d.pop("valueKind"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        concept = d.pop("concept", UNSET)

        _defaults = d.pop("defaults", UNSET)
        defaults: ListMeasuresResponse200DataItemDefaults | Unset
        if isinstance(_defaults, Unset):
            defaults = UNSET
        else:
            defaults = ListMeasuresResponse200DataItemDefaults.from_dict(_defaults)

        _derived_from = d.pop("derivedFrom", UNSET)
        derived_from: ListMeasuresResponse200DataItemDerivedFrom | Unset
        if isinstance(_derived_from, Unset):
            derived_from = UNSET
        else:
            derived_from = ListMeasuresResponse200DataItemDerivedFrom.from_dict(
                _derived_from
            )

        _documents = d.pop("documents", UNSET)
        documents: ListMeasuresResponse200DataItemDocuments | Unset
        if isinstance(_documents, Unset):
            documents = UNSET
        else:
            documents = ListMeasuresResponse200DataItemDocuments.from_dict(_documents)

        _elsewhere = d.pop("elsewhere", UNSET)
        elsewhere: list[ListMeasuresResponse200DataItemElsewhereItem] | Unset = UNSET
        if _elsewhere is not UNSET:
            elsewhere = []
            for elsewhere_item_data in _elsewhere:
                elsewhere_item = ListMeasuresResponse200DataItemElsewhereItem.from_dict(
                    elsewhere_item_data
                )

                elsewhere.append(elsewhere_item)

        _matched_members = d.pop("matchedMembers", UNSET)
        matched_members: (
            list[ListMeasuresResponse200DataItemMatchedMembersItem] | Unset
        ) = UNSET
        if _matched_members is not UNSET:
            matched_members = []
            for matched_members_item_data in _matched_members:
                matched_members_item = (
                    ListMeasuresResponse200DataItemMatchedMembersItem.from_dict(
                        matched_members_item_data
                    )
                )

                matched_members.append(matched_members_item)

        notes = cast(list[str], d.pop("notes", UNSET))

        _resolved_from = d.pop("resolvedFrom", UNSET)
        resolved_from: ListMeasuresResponse200DataItemResolvedFrom | Unset
        if isinstance(_resolved_from, Unset):
            resolved_from = UNSET
        else:
            resolved_from = ListMeasuresResponse200DataItemResolvedFrom.from_dict(
                _resolved_from
            )

        _uncertainty = d.pop("uncertainty", UNSET)
        uncertainty: ListMeasuresResponse200DataItemUncertainty | Unset
        if isinstance(_uncertainty, Unset):
            uncertainty = UNSET
        else:
            uncertainty = ListMeasuresResponse200DataItemUncertainty.from_dict(
                _uncertainty
            )

        _unit_definition = d.pop("unitDefinition", UNSET)
        unit_definition: ListMeasuresResponse200DataItemUnitDefinition | Unset
        if isinstance(_unit_definition, Unset):
            unit_definition = UNSET
        else:
            unit_definition = ListMeasuresResponse200DataItemUnitDefinition.from_dict(
                _unit_definition
            )

        list_measures_response_200_data_item = cls(
            aggregation=aggregation,
            availability=availability,
            description=description,
            dimensions=dimensions,
            id=id,
            label=label,
            links=links,
            series=series,
            sources=sources,
            unit=unit,
            value_kind=value_kind,
            aliases=aliases,
            concept=concept,
            defaults=defaults,
            derived_from=derived_from,
            documents=documents,
            elsewhere=elsewhere,
            matched_members=matched_members,
            notes=notes,
            resolved_from=resolved_from,
            uncertainty=uncertainty,
            unit_definition=unit_definition,
        )

        list_measures_response_200_data_item.additional_properties = d
        return list_measures_response_200_data_item

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
