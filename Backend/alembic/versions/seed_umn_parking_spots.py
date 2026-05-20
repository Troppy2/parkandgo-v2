"""seed UMN parking spots

Revision ID: seed_umn_parking_spots
Revises: phase8_add_data_models
Create Date: 2026-05-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'seed_umn_parking_spots'
down_revision: Union[str, None] = 'phase8_add_data_models'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        INSERT INTO parking_spots
            (spot_name, address, campus_location, parking_type, cost, walk_time, near_buildings, latitude, longitude, is_verified, submitted_by)
        VALUES
            ('19th Avenue Ramp',             '300 19th Ave S Minneapolis MN',        'West Bank', 'Parking Garage', 3.0, NULL, 'Humphrey School / Carlson School',              44.9701, -93.2452, TRUE, NULL),
            ('21st Avenue Ramp',             '400 21st Ave S Minneapolis MN',        'West Bank', 'Parking Garage', 3.0, NULL, 'Carlson School / Hanson Hall',                  44.9686, -93.2435, TRUE, NULL),
            ('Art Museum Garage',            '333 E River Pkwy Minneapolis MN',      'East Bank', 'Parking Garage', 3.0, NULL, 'Weisman Art Museum',                           44.9734, -93.2373, TRUE, NULL),
            ('Church Street Garage',         '80 Church St SE Minneapolis MN',       'East Bank', 'Parking Garage', 3.0, NULL, 'Armory',                                       44.9739, -93.2325, TRUE, NULL),
            ('East River Road Garage',       '391 E River Pkwy Minneapolis MN',      'East Bank', 'Parking Garage', 3.0, NULL, 'Coffman Memorial Union',                       44.9722, -93.2361, TRUE, NULL),
            ('Fourth Street Ramp',           '1625 4th St SE Minneapolis MN',        'East Bank', 'Parking Garage', 3.0, NULL, 'Ridder Arena / Williams Arena',                44.9793, -93.2307, TRUE, NULL),
            ('Gopher Lot',                   '111 TCF Bank Stadium Dr Minneapolis MN','East Bank','Surface Lot',    3.0, NULL, 'Huntington Bank Stadium',                      44.9757, -93.2241, TRUE, NULL),
            ('Gortner Avenue Ramp',          '1395 Gortner Ave St Paul MN',          'St. Paul',  'Parking Garage', 3.0, NULL, 'St. Paul Student Center',                      44.9839, -93.1813, TRUE, NULL),
            ('Lot 101 (Commonwealth Avenue)','1952 Commonwealth Ave St Paul MN',     'St. Paul',  'Surface Lot',    3.0, NULL, 'St. Paul Heating Plant',                       44.9814, -93.1802, TRUE, NULL),
            ('Lot 103 (Bell Museum)',         '2088 Larpenteur Ave W St Paul MN',     'St. Paul',  'Surface Lot',    3.0, NULL, 'Bell Museum',                                  44.9818, -93.1873, TRUE, NULL),
            ('Lot 104 (Buford Avenue)',       '1854 Buford Ave Falcon Heights MN',    'St. Paul',  'Surface Lot',    3.0, NULL, 'Continuing Education and Convention Center',   44.9838, -93.1788, TRUE, NULL),
            ('Lot 106 (Upper Buford Circle)', '1994 Upper Buford Cir St Paul MN',     'St. Paul',  'Surface Lot',    3.0, NULL, 'Animal Science / Vet Med',                     44.9863, -93.1818, TRUE, NULL),
            ('Lot 108 (State Fair Lot)',      '1440 Randall Ave Falcon Heights MN',   'St. Paul',  'Surface Lot',    0.0, NULL, 'State Fairgrounds',                            44.9815, -93.1740, TRUE, NULL),
            ('Lot 161 (Tatum Street)',        'Tatum St St Paul MN',                  'St. Paul',  'Surface Lot',    3.0, NULL, NULL,                                           44.9878, -93.1784, TRUE, NULL),
            ('Lot 37 (Athletics Area)',       '5th St SE Minneapolis MN',             'East Bank', 'Surface Lot',    3.0, NULL, 'Athletics Facilities',                         44.9774, -93.2255, TRUE, NULL),
            ('Lot 86 (2nd Street)',           '2nd St S Minneapolis MN',              'West Bank', 'Surface Lot',    3.0, NULL, NULL,                                           44.9723, -93.2483, TRUE, NULL),
            ('Lot 94 (5th Street)',           '5th St S Minneapolis MN',              'West Bank', 'Surface Lot',    3.0, NULL, NULL,                                           44.9689, -93.2427, TRUE, NULL),
            ('Maroon Lot',                   '2010 6th St SE Minneapolis MN',        'East Bank', 'Surface Lot',    3.0, NULL, 'Huntington Bank Stadium',                      44.9782, -93.2263, TRUE, NULL),
            ('Oak Street Ramp',              '401 Oak St SE Minneapolis MN',         'East Bank', 'Parking Garage', 3.0, NULL, 'McNamara Alumni Center',                       44.9740, -93.2243, TRUE, NULL),
            ('Parkway South Ramp',           '55 W River Pkwy Minneapolis MN',       'East Bank', 'Parking Garage', 3.0, NULL, NULL,                                           44.9720, -93.2380, TRUE, NULL),
            ('Prospect Park Ramp',           '421 29th Ave SE Minneapolis MN',       'East Bank', 'Parking Garage', 3.0, NULL, NULL,                                           44.9719, -93.2128, TRUE, NULL),
            ('University Avenue Ramp',       '1926 University Ave SE Minneapolis MN','East Bank', 'Parking Garage', 3.0, NULL, NULL,                                           44.9760, -93.2285, TRUE, NULL),
            ('Victory Lot',                  '23rd Ave SE Minneapolis MN',           'East Bank', 'Surface Lot',    3.0, NULL, 'Huntington Bank Stadium',                      44.9785, -93.2215, TRUE, NULL),
            ('Washington Avenue Ramp',       '501 Washington Ave SE Minneapolis MN', 'East Bank', 'Parking Garage', 3.0, NULL, 'The Graduate Hotel',                           44.9742, -93.2307, TRUE, NULL),
            ('West Bank Office Building Ramp','1300 S 2nd St Minneapolis MN',        'West Bank', 'Parking Garage', 3.0, NULL, 'West Bank Office Building',                    44.9727, -93.2464, TRUE, NULL)
        ON CONFLICT DO NOTHING;
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        DELETE FROM parking_spots WHERE spot_name IN (
            '19th Avenue Ramp', '21st Avenue Ramp', 'Art Museum Garage',
            'Church Street Garage', 'East River Road Garage', 'Fourth Street Ramp',
            'Gopher Lot', 'Gortner Avenue Ramp', 'Lot 101 (Commonwealth Avenue)',
            'Lot 103 (Bell Museum)', 'Lot 104 (Buford Avenue)', 'Lot 106 (Upper Buford Circle)',
            'Lot 108 (State Fair Lot)', 'Lot 161 (Tatum Street)', 'Lot 37 (Athletics Area)',
            'Lot 86 (2nd Street)', 'Lot 94 (5th Street)', 'Maroon Lot',
            'Oak Street Ramp', 'Parkway South Ramp', 'Prospect Park Ramp',
            'University Avenue Ramp', 'Victory Lot', 'Washington Avenue Ramp',
            'West Bank Office Building Ramp'
        );
    """))
