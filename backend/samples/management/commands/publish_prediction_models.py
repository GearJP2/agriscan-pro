import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Mark trained prediction models as published after metric review.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--version',
            default='latest',
            help='Artifact version directory to publish. Defaults to latest.',
        )
        parser.add_argument(
            '--toxins',
            default='all',
            help='Comma-separated toxin codes to publish, or "all".',
        )
        parser.add_argument(
            '--output-dir',
            default=str(settings.BASE_DIR / 'prediction_artifacts'),
            help='Directory containing versioned prediction artifacts.',
        )

    def handle(self, *args, **options):
        metadata_path = self.resolve_metadata_path(
            Path(options['output_dir']),
            options['version'],
        )
        try:
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f'Could not read prediction metadata: {exc}') from exc

        toxins = self.parse_toxins(options['toxins'])
        updated = 0
        trained_models = metadata.get('trained_models', [])
        for model in trained_models:
            toxin_type = model.get('toxin_type')
            if toxins is None or toxin_type in toxins:
                if not model.get('published', False):
                    updated += 1
                model['published'] = True

        if toxins is not None:
            found = {model.get('toxin_type') for model in trained_models}
            missing = sorted(toxins - found)
            if missing:
                raise CommandError(f'Toxin model(s) not found: {", ".join(missing)}')

        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(
            f'Published {updated} model(s) in {metadata_path.parent.name}.'
        ))

    @staticmethod
    def parse_toxins(value):
        if value == 'all':
            return None
        toxins = {item.strip().upper() for item in value.split(',') if item.strip()}
        if not toxins:
            raise CommandError('--toxins must be "all" or a comma-separated list.')
        return toxins

    @staticmethod
    def resolve_metadata_path(output_dir: Path, version: str) -> Path:
        if version == 'latest':
            candidates = sorted(output_dir.glob('*/metadata.json'), reverse=True)
            if not candidates:
                raise CommandError('No prediction metadata file was found.')
            return candidates[0]

        metadata_path = output_dir / version / 'metadata.json'
        if not metadata_path.exists():
            raise CommandError(f'No prediction metadata file was found for {version}.')
        return metadata_path
