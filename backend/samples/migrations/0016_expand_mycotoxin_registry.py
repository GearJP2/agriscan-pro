from django.db import migrations, models


TOXIN_CHOICES = [
    ('AFB1', 'Aflatoxin B1'), ('AFB2', 'Aflatoxin B2'),
    ('DON', 'Deoxynivalenol'), ('FB1', 'Fumonisin B1'), ('FB2', 'Fumonisin B2'),
    ('ZEA', 'Zearalenone'), ('OTA', 'Ochratoxin A'),
    ('T-2', 'T-2 Toxin'), ('AFG1', 'Aflatoxin G1'),
    ('AFG2', 'Aflatoxin G2'), ('AFM1', 'Aflatoxin M1'),
    ('15ADON', '15-Acetyl-Deoxynivalenol'), ('3ADON', '3-Acetyl-Deoxynivalenol'),
    ('ALT', 'Alternariol'), ('AME', 'Alternariol monomethyl ether'), ('BEA', 'Beauvericin'),
    ('CIT', 'Citrinin'), ('CPA', 'Cyclopiazonic acid'), ('DAS', 'Diacetoxyscirpenol'),
    ('D3G', 'Deoxynivalenol-3-glucoside'), ('EMO', 'Emodin'), ('ENNA', 'Enniatin A'),
    ('ENNA1', 'Enniatin A1'), ('ENNB', 'Enniatin B'), ('ENNB1', 'Enniatin B1'),
    ('FUSA', 'Fusaric acid'), ('HT2', 'HT-2 toxin'), ('MON', 'Moniliformin'), ('MPA', 'Mycophenolic acid'),
    ('NEOS', 'Neosolaniol'), ('NIV', 'Nivalenol'), ('OTB', 'Ochratoxin B'),
    ('PAT', 'Patulin'), ('PAX', 'Paxiline'),
    ('PEN', 'Penitrem A'), ('STC', 'Sterigmatocystin'), ('TEN', 'Tentoxin'),
    ('TEA', 'Tenuazonic acid'), ('TMP', 'Trimethoprim'), ('TRY', 'Tryptophol'),
    ('UNKNOWN', 'Unknown toxin'),
]


class Migration(migrations.Migration):
    dependencies = [('samples', '0015_update_sample_purpose_choices')]

    operations = [
        migrations.AlterField(
            model_name='mycotoxinresult',
            name='toxin_type',
            field=models.CharField(choices=TOXIN_CHOICES, db_index=True, max_length=10),
        ),
    ]
