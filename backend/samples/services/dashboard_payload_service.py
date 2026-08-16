from collections import Counter, defaultdict
from dataclasses import dataclass

from django.conf import settings
from django.db.models import Max, Min

from ..constants.mycotoxin_constants import EU_THRESHOLDS, TOXIN_LABELS
from ..models import Sample
from .analytics_service import AnalyticsService
from .nasa_power_service import NasaPowerService, NasaPowerServiceError


@dataclass(frozen=True)
class DashboardFilters:
    date_from: str = ''
    date_to: str = ''
    region: str = ''
    province: str = ''
    vegetation_variety: str = ''

    @classmethod
    def from_mapping(cls, values):
        def normalize(name):
            value = values.get(name, '')
            if isinstance(value, (list, tuple)):
                return ','.join(str(item) for item in value if item)
            return str(value or '')

        return cls(**{field: normalize(field) for field in cls.__dataclass_fields__})

    def as_dict(self):
        return {key: value for key, value in self.__dict__.items() if value}


class DashboardPayloadService:
    """Build the aggregate dashboard contract without exposing source rows."""

    @classmethod
    def build(
        cls,
        *,
        filters: DashboardFilters,
        threshold_overrides=None,
        include_external=True,
        queryset=None,
    ) -> dict:
        base_queryset = queryset if queryset is not None else Sample.objects.all()
        filtered = AnalyticsService._apply_filters(base_queryset, filters.as_dict())
        samples = list(filtered.prefetch_related('mycotoxin_results'))
        minimum = settings.DASHBOARD_SNAPSHOT_MIN_GROUP_SIZE

        if len(samples) < minimum:
            return cls._empty_sections()

        overview = (
            AnalyticsService.simulate_threshold(
                threshold_overrides,
                filters.as_dict(),
                queryset=base_queryset,
            )
            if threshold_overrides
            else AnalyticsService.get_overview(filters.as_dict(), queryset=base_queryset)
        )
        province_counts = Counter(sample.province or 'Unknown' for sample in samples)
        date_bounds = filtered.aggregate(first=Min('collection_date'), last=Max('collection_date'))

        commodity_stats = defaultdict(lambda: {'sampleCount': 0, 'aboveCount': 0})
        region_stats = defaultdict(lambda: {'sampleCount': 0, 'aboveCount': 0})
        province_stats = defaultdict(
            lambda: {'sampleCount': 0, 'detectedCount': 0, 'aboveCount': 0}
        )
        toxin_stats = defaultdict(lambda: {'sampleCount': 0, 'aboveCount': 0})
        heatmap = defaultdict(lambda: {'sampleCount': 0, 'aboveCount': 0})
        sample_toxins = []
        sample_types = defaultdict(lambda: {'sampleCount': 0, 'aboveCount': 0})

        for sample in samples:
            commodity = sample.vegetation_variety or 'Unknown'
            region = sample.region or 'Unknown'
            results = list(sample.mycotoxin_results.all())
            above = any(cls._is_above(result, commodity, threshold_overrides) for result in results)
            commodity_stats[commodity]['sampleCount'] += 1
            region_stats[region]['sampleCount'] += 1
            province_stats[sample.province or 'Unknown']['sampleCount'] += 1
            heatmap[(region, commodity)]['sampleCount'] += 1
            sample_type = sample.sample_type or 'field'
            sample_types[sample_type]['sampleCount'] += 1
            if above:
                commodity_stats[commodity]['aboveCount'] += 1
                region_stats[region]['aboveCount'] += 1
                heatmap[(region, commodity)]['aboveCount'] += 1
                sample_types[sample_type]['aboveCount'] += 1
                province_stats[sample.province or 'Unknown']['aboveCount'] += 1

            if any(result.value is not None and result.value > 0 for result in results):
                province_stats[sample.province or 'Unknown']['detectedCount'] += 1

            toxins = sorted({
                result.toxin_type for result in results
                if result.value is not None and result.value > 0
            })
            sample_toxins.append(toxins)
            for result in results:
                toxin_stats[result.toxin_type]['sampleCount'] += 1
                if cls._is_above(result, commodity, threshold_overrides):
                    toxin_stats[result.toxin_type]['aboveCount'] += 1

        global_sensitive_counts = (
            sum(value['detectedCount'] for value in province_stats.values()),
            sum(value['aboveCount'] for value in commodity_stats.values()),
            sum(1 for sample in samples if sample.status == 'flagged'),
        )
        if any(0 < count < minimum for count in global_sensitive_counts):
            return cls._empty_sections()

        visible_commodities, suppressed_commodities = cls._visible_stat_keys(
            commodity_stats, minimum, ('aboveCount',)
        )
        visible_regions, _suppressed_regions = cls._visible_stat_keys(
            region_stats, minimum, ('aboveCount',)
        )
        visible_provinces, suppressed_provinces = cls._visible_stat_keys(
            province_stats, minimum, ('detectedCount', 'aboveCount')
        )
        overview['provinces'] = sorted(
            (row for row in overview.pop('provinces') if row['name'] in visible_provinces),
            key=lambda row: (-row['sampleCount'], row['name']),
        )

        commodities = [
            {
                'name': name,
                **counts,
                'pctAbove': cls._percent(counts['aboveCount'], counts['sampleCount']),
            }
            for name, counts in commodity_stats.items()
            if name in visible_commodities
        ]
        commodities.sort(key=lambda item: (-item['sampleCount'], item['name']))
        regions = [
            {
                'name': name,
                **counts,
                'aboveThresholdPct': cls._percent(counts['aboveCount'], counts['sampleCount']),
            }
            for name, counts in region_stats.items()
            if name in visible_regions
        ]
        regions.sort(key=lambda item: (-item['aboveThresholdPct'], item['name']))
        overview['kpis']['high_risk_regions'] = len({
            row['region'] for row in overview['provinces']
            if row['riskLevel'] in ('high', 'critical')
        })
        overview['kpis']['highest_risk_commodity'] = (
            max(commodities, key=lambda item: item['pctAbove'])['name']
            if commodities else 'N/A'
        )

        visible_toxins, _suppressed_toxins = cls._visible_stat_keys(
            toxin_stats, minimum, ('aboveCount',)
        )
        toxins = [
            {
                'name': TOXIN_LABELS.get(name, name),
                'shortName': name,
                **counts,
                'score': cls._percent(counts['aboveCount'], len(samples)),
            }
            for name, counts in toxin_stats.items()
            if name in visible_toxins
        ]
        toxins.sort(key=lambda item: (-item['aboveCount'], item['shortName']))

        visible_heatmap, _suppressed_heatmap = cls._visible_stat_keys(
            heatmap, minimum, ('aboveCount',)
        )
        heatmap_cells = [
            {
                'region': region,
                'commodity': commodity,
                'sampleCount': counts['sampleCount'],
                'intensity': cls._percent(counts['aboveCount'], counts['sampleCount']),
            }
            for (region, commodity), counts in heatmap.items()
            if (region, commodity) in visible_heatmap
        ]
        heatmap_cells.sort(key=lambda item: (item['region'], item['commodity']))

        co_contamination = cls._co_contamination(sample_toxins, minimum)
        visible_sample_types, _suppressed_sample_types = cls._visible_stat_keys(
            sample_types, minimum, ('aboveCount',)
        )
        public_health = cls._public_health(
            overview,
            commodities,
            toxins,
            {key: sample_types[key] for key in visible_sample_types},
            minimum,
        )
        environmental = cls._environmental(
            filters,
            province_counts,
            visible_provinces,
        ) if include_external else {'status': 'unavailable', 'data': {}}

        return {
            'filter_options': {
                'commodities': sorted(visible_commodities),
                'regions': sorted(visible_regions),
                'provinces': sorted(visible_provinces),
                'date_range': {
                    'from': date_bounds['first'].isoformat() if date_bounds['first'] else '',
                    'to': date_bounds['last'].isoformat() if date_bounds['last'] else '',
                },
            },
            'overview': overview,
            'regional': {
                'provinces': overview['provinces'],
                'regions': regions,
                'suppressed': suppressed_provinces,
            },
            'commodities': {
                'distribution': commodities,
                'suppressed': suppressed_commodities,
            },
            'toxins': {'distribution': toxins},
            'heatmap': {
                'data': heatmap_cells,
                'regions': sorted({cell['region'] for cell in heatmap_cells}),
                'commodities': sorted({cell['commodity'] for cell in heatmap_cells}),
            },
            'co_contamination': co_contamination,
            'public_health': public_health,
            'environmental': environmental,
        }

    @staticmethod
    def _visible_keys(counts, minimum, unsafe=None):
        """Apply primary and complementary suppression to one partition."""
        unsafe = unsafe or set()
        visible = {
            key for key, count in counts.items()
            if count >= minimum and key not in unsafe
        }
        suppressed = len(counts) - len(visible)
        if suppressed and visible:
            complement = min(visible, key=lambda key: (counts[key], str(key)))
            visible.remove(complement)
            suppressed += 1
        return visible, suppressed

    @classmethod
    def _visible_stat_keys(cls, stats, minimum, sensitive_fields):
        counts = Counter({key: value['sampleCount'] for key, value in stats.items()})
        unsafe = {
            key for key, value in stats.items()
            if any(0 < value[field] < minimum for field in sensitive_fields)
        }
        return cls._visible_keys(counts, minimum, unsafe)

    @staticmethod
    def _percent(numerator, denominator):
        return round(numerator / denominator * 100, 1) if denominator else 0

    @staticmethod
    def _is_above(result, commodity, overrides):
        threshold = None
        toxin_overrides = (overrides or {}).get(result.toxin_type, {})
        if commodity in toxin_overrides:
            threshold = float(toxin_overrides[commodity])
        elif commodity.lower() in toxin_overrides:
            threshold = float(toxin_overrides[commodity.lower()])
        if threshold is None:
            threshold = EU_THRESHOLDS.get(result.toxin_type, {}).get('low')
        return result.value is not None and threshold is not None and result.value > threshold

    @classmethod
    def _co_contamination(cls, samples, minimum):
        intersections = Counter(' + '.join(toxins) for toxins in samples if toxins)
        visible_combinations, _suppressed = cls._visible_keys(intersections, minimum)
        visible_samples = [
            toxins for toxins in samples
            if ' + '.join(toxins) in visible_combinations
        ]
        nodes = Counter(toxin for toxins in visible_samples for toxin in toxins)
        links = Counter()
        for toxins in visible_samples:
            for index, source in enumerate(toxins):
                for target in toxins[index + 1:]:
                    links[(source, target)] += 1
        positive = len(visible_samples)
        two_plus = sum(1 for toxins in visible_samples if len(toxins) >= 2)
        three_plus = sum(1 for toxins in visible_samples if len(toxins) >= 3)
        total_toxins = sum(len(toxins) for toxins in visible_samples)
        visible_intersections = [
            {
                'toxins': key.split(' + '),
                'sampleCount': count,
                'pct': cls._percent(count, positive),
            }
            for key, count in sorted(intersections.items(), key=lambda item: (-item[1], item[0]))
            if key in visible_combinations
        ]
        visible_intersections = visible_intersections[:15]
        visible_link_keys, _suppressed_links = cls._visible_keys(links, minimum)
        visible_links = [
            {'source': source, 'target': target, 'value': count}
            for (source, target), count in sorted(
                links.items(), key=lambda item: (-item[1], item[0])
            )
            if (source, target) in visible_link_keys
        ]
        most_common_pair = visible_links[0] if visible_links else None
        summary = {
            'avgToxinsPerSample': round(total_toxins / positive, 2) if positive >= minimum else 0,
            'pctTwoPlus': cls._percent(two_plus, positive) if positive >= minimum else 0,
            'pctThreePlus': cls._percent(three_plus, positive) if positive >= minimum else 0,
            'mostCommonPair': (
                f'{most_common_pair["source"]} + {most_common_pair["target"]}'
                if most_common_pair else 'None'
            ),
        }
        return {
            'summary': summary,
            'intersections': visible_intersections,
            'network': {
                'nodes': [
                    {'id': toxin, 'frequency': count}
                    for toxin, count in sorted(nodes.items())
                    if count >= minimum
                ],
                'links': visible_links,
            },
            'toxins_per_sample': {
                key: count for key, count in {
                    '1': sum(1 for toxins in visible_samples if len(toxins) == 1),
                    '2': sum(1 for toxins in visible_samples if len(toxins) == 2),
                    '3': sum(1 for toxins in visible_samples if len(toxins) == 3),
                    '4+': sum(1 for toxins in visible_samples if len(toxins) >= 4),
                }.items() if count >= minimum
            },
        }

    @staticmethod
    def _environmental(filters, province_counts, visible_provinces):
        if not visible_provinces:
            return {'status': 'unavailable', 'data': {}}
        province = max(visible_provinces, key=lambda name: (province_counts[name], name))
        external_filters = {**filters.as_dict(), 'province': province}
        try:
            cached = NasaPowerService.get_cached_environmental_correlation(external_filters)
        except NasaPowerServiceError:
            return {'status': 'unavailable', 'data': {}}
        return cached or {'status': 'unavailable', 'data': {}}

    @staticmethod
    def _empty_sections():
        return {
            'filter_options': {
                'commodities': [], 'regions': [], 'provinces': [],
                'date_range': {'from': '', 'to': ''},
            },
            'overview': {
                'kpis': {
                    'total_samples': 0, 'positive_pct': 0, 'detected_pct': 0,
                    'above_threshold_pct': 0, 'high_risk_regions': 0,
                    'highest_risk_commodity': 'N/A', 'active_alerts': 0,
                },
                'provinces': [],
            },
            'regional': {'provinces': [], 'regions': [], 'suppressed': 1},
            'commodities': {'distribution': [], 'suppressed': 1},
            'toxins': {'distribution': []},
            'heatmap': {'data': [], 'regions': [], 'commodities': []},
            'co_contamination': {
                'summary': {
                    'avgToxinsPerSample': 0, 'pctTwoPlus': 0,
                    'pctThreePlus': 0, 'mostCommonPair': 'None',
                },
                'intersections': [], 'network': {'nodes': [], 'links': []},
                'toxins_per_sample': {},
            },
            'public_health': {
                'riskDrivers': [], 'affectedCommodities': [], 'impactedPopulations': [],
            },
            'environmental': {'status': 'unavailable', 'data': {}},
        }

    @classmethod
    def _public_health(cls, overview, commodities, toxins, sample_types, minimum):
        drivers = []
        if toxins:
            drivers.append(f"{toxins[0]['name']} is the strongest visible toxin signal.")
        if commodities:
            riskiest = max(commodities, key=lambda item: item['pctAbove'])
            drivers.append(f"{riskiest['name']} has the highest visible above-threshold share.")
        if overview['kpis']['high_risk_regions']:
            drivers.append('High-risk areas require targeted follow-up sampling.')
        return {
            'riskDrivers': drivers,
            'affectedCommodities': [
                {'name': item['name'], 'pct': round(item['pctAbove'])}
                for item in sorted(commodities, key=lambda item: -item['pctAbove'])[:4]
            ],
            'impactedPopulations': [
                {
                    'group': name.replace('_', ' ').title(),
                    'severity': 'High' if cls._percent(value['aboveCount'], value['sampleCount']) >= 25 else 'Medium',
                }
                for name, value in sorted(sample_types.items())
                if value['sampleCount'] >= minimum
            ],
        }
