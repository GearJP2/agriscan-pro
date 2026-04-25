import os
import django
import csv
import sys
from datetime import date

# Set up Django environment
# Add current directory to path if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/..')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from samples.models import Sample, MycotoxinResult, ProcessLog
from samples.constants.mycotoxin_constants import VALID_TOXINS
from accounts.models import User

def seed_samples():
    user = User.objects.filter(username='Sinu').first()
    if not user:
        user = User.objects.first()
    
    if not user:
        print("No user found in database. Please create a user first.")
        return

    # Look for CSV in several locations
    possible_paths = [
        'agriscan_samples.csv',
        '../agriscan_samples.csv',
        '/home/sinu/Workspace/Code/Project/agriscan-pro/agriscan_samples.csv'
    ]
    
    csv_file = None
    for p in possible_paths:
        if os.path.exists(p):
            csv_file = p
            break
            
    if not csv_file:
        print(f"CSV file not found in any of: {possible_paths}")
        return

    print(f"Using CSV file: {csv_file}")

    with open(csv_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            # Basic mapping
            sample_id = row['Sample names']
            region = row['Regions']
            province = row['Provinces']
            district = row['Districts']
            variety = row['Varieties']
            processing = row['Processing type'].lower()
            
            # Map Crops (Year) to a date
            try:
                collection_year = int(row['Crops'])
            except ValueError:
                collection_year = 2026
            collection_date = date(collection_year, 1, 1)

            # Create or update sample
            sample, created = Sample.objects.update_or_create(
                sample_id=sample_id,
                defaults={
                    'region': region,
                    'province': province,
                    'district': district,
                    'vegetation_variety': variety,
                    'collection_date': collection_date,
                    'processing_type': processing,
                    'status': 'completed',
                    'updated_by': user,
                    'purpose': 'routine',
                    'sample_type': 'field',
                }
            )
            
            # Add process log
            ProcessLog.objects.get_or_create(
                sample=sample,
                state='completed',
                conducted_by='System Seed',
                defaults={'notes': 'Imported via sample seed script'}
            )

            # Add toxin results
            for t in sorted(VALID_TOXINS - {'UNKNOWN'}):
                val_str = row.get(t, '').strip().upper()
                if val_str in ['ND', '<LOD', '']:
                    continue
                
                try:
                    # Handle comma as decimal separator if any
                    clean_val_str = val_str.replace(',', '.')
                    val = float(clean_val_str)
                    MycotoxinResult.objects.update_or_create(
                        sample=sample,
                        toxin_type=t,
                        defaults={
                            'value': val,
                            'unit': 'ug_kg',
                            'notes': 'LC-MS/MS',
                        }
                    )
                except ValueError:
                    continue
            
            count += 1
            print(f"{'Created' if created else 'Updated'} sample {sample_id}")
            
        print(f"\nSuccessfully processed {count} samples.")

if __name__ == '__main__':
    seed_samples()
