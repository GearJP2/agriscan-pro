from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from samples.services.ingestion_service import SampleIngestionService


class Command(BaseCommand):
    help = 'Import the dashboard CSV, creating missing samples and upserting results by sample ID.'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', help='Path to the Dashboard - Results.csv file')
        parser.add_argument('--username', help='Optional account recorded as the importer')

    def handle(self, *args, **options):
        try:
            file_handle = open(options['csv_path'], 'rb')
        except OSError as exc:
            raise CommandError(f'Could not open CSV: {exc}') from exc

        user = None
        if options.get('username'):
            user = get_user_model().objects.filter(username=options['username']).first()
            if not user:
                raise CommandError(f"User '{options['username']}' was not found.")

        with file_handle:
            result = SampleIngestionService.process_csv_results(
                file_handle, user, create_missing_samples=True,
            )

        self.stdout.write(self.style.SUCCESS(
            'Imported {created_samples} samples; created {created} and updated {updated} mycotoxin results '
            'across {samples} matched samples. Skipped {skipped_rows} rows.'.format(**result)
        ))
