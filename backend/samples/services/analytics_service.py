from django.db.models import Count, Q, Avg, FloatField
from django.db.models.functions import Cast
from django.utils.dateparse import parse_date
from collections import defaultdict
from ..models import Sample, MycotoxinResult
from ..constants.mycotoxin_constants import EU_THRESHOLDS, TOXIN_ALIASES

class AnalyticsService:

    @staticmethod
    def _apply_filters(queryset, filters):
        date_from = filters.get('date_from')
        date_to = filters.get('date_to')
        region = filters.get('region')
        vegetation_variety = filters.get('vegetation_variety')

        if date_from:
            parsed = parse_date(date_from)
            if parsed:
                queryset = queryset.filter(collection_date__gte=parsed)
        if date_to:
            parsed = parse_date(date_to)
            if parsed:
                queryset = queryset.filter(collection_date__lte=parsed)
        if region:
            regions = region.split(',')
            queryset = queryset.filter(region__in=regions)
        if vegetation_variety:
            varieties = vegetation_variety.split(',')
            queryset = queryset.filter(vegetation_variety__in=varieties)
            
        return queryset

    @staticmethod
    def get_overview(filters: dict) -> dict:
        """
        Overview KPIs and province-level risks without fetching all samples.
        """
        qs = Sample.objects.all()
        qs = AnalyticsService._apply_filters(qs, filters)

        # Basic Stats
        total_samples = qs.count()
        positive_samples = qs.filter(mycotoxin_results__isnull=False).distinct().count()
        high_risk_samples = qs.filter(mycotoxin_results__risk_level__in=['high', 'critical']).distinct().count()

        # Group by province for Regional Risk
        province_data = qs.values('province', 'region').annotate(
            sample_count=Count('id', distinct=True),
            above_threshold_count=Count(
                'id', 
                filter=Q(mycotoxin_results__risk_level__in=['high', 'critical']), 
                distinct=True
            )
        )

        provinces = []
        high_risk_regions = set()
        
        for pd in province_data:
            sample_count = pd['sample_count']
            above_threshold = pd['above_threshold_count']
            above_pct = (above_threshold / sample_count * 100) if sample_count > 0 else 0
            
            risk_level = 'low'
            if above_pct >= 50:
                risk_level = 'critical'
            elif above_pct >= 25:
                risk_level = 'high'
            elif above_pct >= 10:
                risk_level = 'medium'

            if risk_level in ['high', 'critical']:
                high_risk_regions.add(pd['region'])
                
            provinces.append({
                'name': pd['province'],
                'region': pd['region'],
                'sampleCount': sample_count,
                'aboveThresholdPct': round(above_pct, 1),
                'riskLevel': risk_level,
                # We calculate dominantToxin later if needed or omit for performance
                'dominantToxin': 'Unknown', 
                'dominantCommodity': 'Unknown'
            })

        provinces.sort(key=lambda x: x['aboveThresholdPct'], reverse=True)

        # Highest Risk Commodity calculation
        commodity_data = qs.values('vegetation_variety').annotate(
            total=Count('id', distinct=True),
            above=Count('id', filter=Q(mycotoxin_results__risk_level__in=['high', 'critical']), distinct=True)
        )
        
        highest_risk_commodity = "N/A"
        max_pct = -1
        for cd in commodity_data:
            pct = (cd['above'] / cd['total'] * 100) if cd['total'] > 0 else 0
            if pct > max_pct:
                max_pct = pct
                highest_risk_commodity = cd['vegetation_variety'] or "Unknown"

        # Active Alerts (Flagged samples)
        active_alerts = qs.filter(status='flagged').count()

        return {
            'kpis': {
                'total_samples': total_samples,
                'positive_pct': round((positive_samples / total_samples * 100), 1) if total_samples > 0 else 0,
                'above_threshold_pct': round((high_risk_samples / total_samples * 100), 1) if total_samples > 0 else 0,
                'high_risk_regions': len(high_risk_regions),
                'highest_risk_commodity': highest_risk_commodity,
                'active_alerts': active_alerts
            },
            'provinces': provinces
        }

    @staticmethod
    def get_co_contamination(filters: dict) -> dict:
        """
        UpSet plot data (intersections) and network data.
        """
        qs = Sample.objects.prefetch_related('mycotoxin_results').filter(mycotoxin_results__isnull=False).distinct()
        qs = AnalyticsService._apply_filters(qs, filters)
        
        # We process this partially in python because cross-combinations in DB is tricky without raw CTEs
        co_occurrences = defaultdict(int)
        toxins_per_sample = {1: 0, 2: 0, 3: 0, 4: 0} # 4 means 4+
        
        network_edges = defaultdict(int)
        node_freq = defaultdict(int)

        positive_count = 0
        for sample in qs:
            positive_count += 1
            # Sort to ensure consistent combination keys
            toxins = sorted(list(set([r.toxin_type for r in sample.mycotoxin_results.all()])))
            
            # Toxin per sample dist
            t_count = len(toxins)
            if t_count >= 4:
                toxins_per_sample[4] += 1
            elif t_count > 0:
                toxins_per_sample[t_count] += 1
            
            # UpSet exact match
            key = " + ".join(toxins)
            if key:
                co_occurrences[key] += 1
                
            # Network nodes/edges
            for t in toxins:
                node_freq[t] += 1
            
            for i in range(len(toxins)):
                for j in range(i + 1, len(toxins)):
                    edge = sorted([toxins[i], toxins[j]])
                    network_edges[f"{edge[0]}-{edge[1]}"] += 1

        combinations = []
        for combo, count in sorted(co_occurrences.items(), key=lambda x: x[1], reverse=True):
            combinations.append({
                'toxins': combo.split(" + "),
                'sampleCount': count,
                'pct': round((count / positive_count * 100), 1) if positive_count > 0 else 0
            })

        # Format Network Data
        nodes = [{'id': k, 'frequency': v} for k, v in node_freq.items()]
        links = [{'source': k.split('-')[0], 'target': k.split('-')[1], 'value': v} for k, v in network_edges.items()]

        return {
            'toxins_per_sample': {
                '1': toxins_per_sample.get(1, 0),
                '2': toxins_per_sample.get(2, 0),
                '3': toxins_per_sample.get(3, 0),
                '4+': toxins_per_sample.get(4, 0),
            },
            'intersections': combinations[:15], # top 15 combinations for upset
            'network': {
                'nodes': sorted(nodes, key=lambda x: x['frequency'], reverse=True),
                'links': sorted(links, key=lambda x: x['value'], reverse=True)
            }
        }

    @staticmethod
    def simulate_threshold(overrides: dict, filters: dict) -> dict:
        """
        Dynamically recalculate risk levels based on overridden thresholds per-variety.
        overrides format: { 'AFB1': { 'maize': 10, 'peanuts': 5 } }
        """
        qs = Sample.objects.prefetch_related('mycotoxin_results').all()
        qs = AnalyticsService._apply_filters(qs, filters)

        total_samples = 0
        total_above = 0
        
        above_by_region = defaultdict(int)
        above_by_commodity = defaultdict(int)
        total_by_commodity = defaultdict(int)
        above_by_province = defaultdict(int)
        above_by_province_total = defaultdict(int)
        
        for sample in qs:
            total_samples += 1
            variety = sample.vegetation_variety or 'unknown'
            province = sample.province or 'unknown'
            total_by_commodity[variety] += 1
            above_by_province_total[province] += 1
            
            is_above = False
            for result in sample.mycotoxin_results.all():
                toxin = result.toxin_type
                val = result.value
                if val is None:
                    continue
                
                # Check for override
                # Toxin -> Variety -> Value
                threshold = None
                if overrides and toxin in overrides:
                    # check variety exact match or lowercase
                    if variety in overrides[toxin]:
                        threshold = overrides[toxin][variety]
                    elif variety.lower() in overrides[toxin]:
                        threshold = overrides[toxin][variety.lower()]

                if threshold is None:
                    # Fallback to EU base
                    eu = EU_THRESHOLDS.get(toxin, {})
                    threshold = eu.get('high') # 'low' or 'high' ? We match existing logic which uses 'low' -> high, 'high' -> critical. We'll use 'low' to mirror current "above threshold".
                    # Actually original calculates dangerous if risk in ['high', 'critical'] which means > eu_threshold_low
                    threshold = eu.get('low')

                if threshold is not None and val > threshold:
                    is_above = True
                    break

            if is_above:
                total_above += 1
                above_by_region[sample.region] += 1
                above_by_commodity[variety] += 1
                above_by_province[province] += 1

        # Find highest risk commodity in simulation
        highest_risk_commodity = "N/A"
        max_pct = -1
        for k, total in total_by_commodity.items():
            pct = (above_by_commodity[k] / total * 100) if total > 0 else 0
            if pct > max_pct:
                max_pct = pct
                highest_risk_commodity = k

        # Active Alerts (Flagged samples)
        active_alerts = qs.filter(status='flagged').count()

        return {
            'kpis': {
                'total_samples': total_samples,
                'positive_pct': round((qs.filter(mycotoxin_results__isnull=False).distinct().count() / total_samples * 100), 1) if total_samples > 0 else 0,
                'above_threshold_pct': round((total_above / total_samples * 100), 1) if total_samples > 0 else 0,
                'high_risk_regions': len(above_by_region),
                'highest_risk_commodity': highest_risk_commodity,
                'active_alerts': active_alerts
            },
            'provinces': [
                {
                    'name': p['province'],
                    'region': p['region'],
                    'sampleCount': above_by_province_total[p['province']],
                    'aboveThresholdPct': round((above_by_province[p['province']] / above_by_province_total[p['province']] * 100), 1) if above_by_province_total[p['province']] > 0 else 0,
                    'riskLevel': 'high' if (above_by_province[p['province']] / above_by_province_total[p['province']]) >= 0.25 else 'low'
                } for p in qs.values('province', 'region').distinct()
            ]
        }

    @staticmethod
    def get_environmental_correlation(filters: dict) -> dict:
        """
        Stub for scatter plot. Returns a warning flag about TMD API requirement.
        """
        return {
            'data': [],
            'requires_tmd_api': True,
            'message': 'Weather correlation requires integration with the Thai Meteorological Department API for historical moisture/rainfall data.'
        }
