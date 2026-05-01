import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from samples.models import Sample, ProcessLog, MycotoxinResult
from samples.utils import generate_sequential_sample_id

class Command(BaseCommand):
    help = 'Seeds the database with demo agricultural samples'

    def handle(self, *args, **options):
        regions = ['Northern', 'Central', 'Southern', 'Northeastern']
        provinces = {
            'Northern': ['Chiang Mai', 'Chiang Rai', 'Nan'],
            'Central': ['Bangkok', 'Ayutthaya', 'Saraburi'],
            'Southern': ['Phuket', 'Surat Thani', 'Songkhla'],
            'Northeastern': ['Khon Kaen', 'Udon Thani', 'Nakhon Ratchasima']
        }
        varieties = ['Khao Dawk Mali 105', 'RD6', 'Suphan Buri 1', 'Pathum Thani 1']
        sample_types = ['field', 'market', 'storage', 'export']
        states = ['registered', 'preparing', 'prepared', 'analyzing', 'recorded', 'completed']
        toxins = ['Aflatoxin B1', 'Ochratoxin A', 'Deoxynivalenol', 'Zearalenone']

        self.stdout.write('Seeding samples...')
        
        for i in range(20):
            region = random.choice(regions)
            province = random.choice(provinces[region])
            variety = random.choice(varieties)
            s_type = random.choice(sample_types)
            
            collection_date = timezone.now() - timedelta(days=random.randint(1, 60))
            sample_id, seq = generate_sequential_sample_id(collection_date)
            
            sample = Sample.objects.create(
                sample_id=sample_id,
                sequence_number=seq,
                region=region,
                province=province,
                district='District ' + str(random.randint(1, 5)),
                vegetation_variety=variety,
                sample_type=s_type,
                collection_date=collection_date,
                status='active'
            )
            
            # Add some process logs
            num_logs = random.randint(1, len(states))
            for j in range(num_logs):
                ProcessLog.objects.create(
                    sample=sample,
                    state=states[j],
                    conducted_by='Admin User',
                    timestamp=collection_date + timedelta(hours=j*2)
                )
            
            # If completed, add some results
            if num_logs >= 5:
                for toxin in toxins:
                    val = random.uniform(0, 30)
                    MycotoxinResult.objects.create(
                        sample=sample,
                        toxin_type=toxin,
                        value=val,
                        unit='µg/kg',
                        timestamp=collection_date + timedelta(days=1)
                    )

        self.stdout.write(self.style.SUCCESS('Successfully seeded 20 samples'))
