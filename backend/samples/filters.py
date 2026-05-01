"""Query-string filter helpers for the SampleViewSet.

Keeps the viewset thin by isolating each query parameter's filter logic in a
dedicated function. Risk-level filtering is the most involved branch because
it derives from MycotoxinResult rows rather than a column on Sample itself.
"""

from django.db.models import Exists, OuterRef, Q

from .models import MycotoxinResult


def _filter_status(queryset, value: str):
    """Filter by one or more comma-separated status values."""
    statuses = [s for s in value.split(",") if s]
    return queryset.filter(status__in=statuses) if statuses else queryset


def _filter_date_range(queryset, date_from: str | None, date_to: str | None):
    """Apply inclusive collection_date range bounds when present."""
    if date_from:
        queryset = queryset.filter(collection_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(collection_date__lte=date_to)
    return queryset


def _filter_sample_type(queryset, value: str):
    """Filter by one or more comma-separated sample type values."""
    types = [t for t in value.split(",") if t]
    return queryset.filter(sample_type__in=types) if types else queryset


def apply_sample_filters(queryset, params):
    """Apply every supported query-param filter to a Sample queryset."""
    if status_param := params.get("status"):
        queryset = _filter_status(queryset, status_param)

    for field in ("region", "province"):
        if value := params.get(field):
            values = [v for v in value.split(",") if v]
            queryset = queryset.filter(**{f"{field}__in": values}) if values else queryset

    if vegetation := params.get("vegetation"):
        values = [v for v in vegetation.split(",") if v]
        queryset = queryset.filter(vegetation_variety__in=values) if values else queryset

    queryset = _filter_date_range(
        queryset,
        params.get("date_from"),
        params.get("date_to"),
    )

    if sample_type := params.get("sample_type"):
        queryset = _filter_sample_type(queryset, sample_type)

    return queryset
