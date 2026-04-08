import csv
import re
import logging
from io import TextIOWrapper
from samples.models import Sample, ProcessLog, MycotoxinResult

logger = logging.getLogger('agriscan.samples')

TOXIN_DEFAULTS = {
    'AFB1': {'threshold': 5.0, 'unit': 'ppb'},
    'AFB2': {'threshold': 5.0, 'unit': 'ppb'},
    'AFG1': {'threshold': 5.0, 'unit': 'ppb'},
    'AFG2': {'threshold': 5.0, 'unit': 'ppb'},
    'AFM1': {'threshold': 0.5, 'unit': 'ppb'},
    'AF': {'threshold': 5.0, 'unit': 'ppb'},
    'DON': {'threshold': 1000.0, 'unit': 'ppb'},
    'FB1': {'threshold': 2000.0, 'unit': 'ppb'},
    'T-2': {'threshold': 100.0, 'unit': 'ppb'},
    'ZEA': {'threshold': 200.0, 'unit': 'ppb'},
    'OTA': {'threshold': 5.0, 'unit': 'ppb'},
}

TOXIN_ALIASES = {
    'don': 'DON', 'deoxynivalenol': 'DON',
    'afb1': 'AFB1', 'afb2': 'AFB2', 'afg1': 'AFG1', 'afg2': 'AFG2', 'afm1': 'AFM1',
    'af': 'AF', 'aflatoxin': 'AF', 'fb1': 'FB1', 't2': 'T-2', 't-2': 'T-2', 'zea': 'ZEA', 'ota': 'OTA'
}

class SampleIngestionService:
    @staticmethod
    def normalize_token(value):
        return re.sub(r'[^a-z0-9]+', '', str(value or '').strip().lower())

    @staticmethod
    def normalize_sample_id(value):
        if value is None: return ''
        text = str(value).strip().upper()
        text = text.replace('\u2010', '-').replace('\u2011', '-').replace('\u2012', '-').replace('\u2013', '-').replace('\u2014', '-')
        text = re.sub(r'\s+', '', text)
        parts = text.split('-')
        normalized_parts = [str(int(p)) if p.isdigit() else p for p in parts]
        return '-'.join(normalized_parts)

    @classmethod
    def get_row_value(cls, row, candidate_keys):
        normalized_map = {cls.normalize_token(k): v for k, v in (row or {}).items()}
        for key in candidate_keys:
            if key in row: return row[key]
            norm_key = cls.normalize_token(key)
            if norm_key in normalized_map: return normalized_map[norm_key]
        return None

    @classmethod
    def extract_row_sample_id(cls, row):
        key_groups = [['sample_id', 'sample id', 'sampleid'], ['name'], ['sample'], ['']]
        for keys in key_groups:
            val = cls.get_row_value(row, keys)
            if not val: continue
            norm = cls.normalize_sample_id(val)
            if not norm or norm in {'NAME', 'SAMPLE', 'DATE'}: continue
            return str(val).strip(), norm
        return '', ''

    @classmethod
    def resolve_toxin_name(cls, value):
        raw = str(value or '').strip().upper()
        if raw in TOXIN_DEFAULTS: return raw
        norm = cls.normalize_token(raw)
        return TOXIN_ALIASES.get(norm)

    @staticmethod
    def parse_numeric(value):
        text = str(value or '').strip().lower()
        if text in {'nd', 'bdl', '<lod', 'lod', 'n/a', '-', '#value!'}: return 0.0
        match = re.search(r'[-+]?\d*\.?\d+', text.replace(',', ''))
        return float(match.group(0)) if match else None

    @classmethod
    def process_csv_results(cls, uploaded_file, user):
        wrapped = TextIOWrapper(uploaded_file.file, encoding='utf-8-sig')
        rows = list(csv.DictReader(wrapped))
        
        # Optimization: Filter by display IDs found in CSV instead of full table scan.
        # Use display_id (raw from CSV) for the DB filter since sample_id is stored in its original form.
        csv_display_ids = set()
        for row in rows:
            display_id, _ = cls.extract_row_sample_id(row)
            if display_id: csv_display_ids.add(display_id.strip())

        sample_map = {cls.normalize_sample_id(s.sample_id): s for s in Sample.objects.filter(sample_id__in=csv_display_ids)}
        
        created, updated = 0, 0
        touched_samples = set()

        for row in rows:
            display_id, sid = cls.extract_row_sample_id(row)
            sample = sample_map.get(sid)
            if not sample: continue

            # Extract mycotoxin results (Simplified for service)
            toxin_key = cls.get_row_value(row, ['mycotoxin', 'toxin', 'name'])
            if toxin_key:
                name = cls.resolve_toxin_name(toxin_key)
                intensity = cls.parse_numeric(cls.get_row_value(row, ['intensity', 'value']))
                if name and intensity is not None:
                    _, is_new = MycotoxinResult.objects.update_or_create(
                        sample=sample, name=name,
                        defaults={
                            'intensity': intensity,
                            'threshold': TOXIN_DEFAULTS.get(name, {}).get('threshold', 0.0),
                            'unit': TOXIN_DEFAULTS.get(name, {}).get('unit', 'ppb'),
                            'is_detected': intensity > 0,
                            'dangerous': intensity > TOXIN_DEFAULTS.get(name, {}).get('threshold', 0.0)
                        }
                    )
                    if is_new: created += 1
                    else: updated += 1
                    touched_samples.add(sample)

        for sample in touched_samples:
            sample.status = 'completed'
            sample.updated_by = user
            sample.save()
            ProcessLog.objects.create(sample=sample, state='completed', conducted_by=user.username)

        return {'created': created, 'updated': updated, 'samples': len(touched_samples)}
