-- Run this file after creating the database:
--   createdb parkandgo_db
-- Then connect with:
--   psql -d parkandgo_db -f parkandgo_db_postgres.sql

-- Table 1: Users
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    profile_pic VARCHAR(500),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    prefered_name VARCHAR(100) NOT NULL,
    preferred_parking_types VARCHAR(250),
    major VARCHAR(100),
    major_category VARCHAR(100),
    grade_level VARCHAR(100),
    graduation_year INT,
    housing_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- Table 2: Parking Spots
CREATE TABLE parking_spots (
    spot_id SERIAL PRIMARY KEY,
    spot_name VARCHAR(100) NOT NULL,
    campus_location VARCHAR(100),
    parking_type VARCHAR(100),
    cost DOUBLE PRECISION,
    walk_time VARCHAR(100),
    near_buildings TEXT,
    address VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: User Parking History
CREATE TABLE user_parking_history (
    history_id SERIAL PRIMARY KEY,
    user_id INT,
    spot_id INT,
    preferred_campus VARCHAR(20),
    typical_arrival_time VARCHAR(20),
    frequency VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (spot_id) REFERENCES parking_spots(spot_id) ON DELETE CASCADE
);

-- Table 4: Major Campus Mapping
CREATE TABLE major_campus_mapping (
    mapping_id SERIAL PRIMARY KEY,
    major_name VARCHAR(100) NOT NULL,
    major_category VARCHAR(50),
    primary_campus VARCHAR(20),
    common_buildings TEXT
);

-- Updated Parking Spots
INSERT INTO parking_spots (spot_name, campus_location, parking_type, cost, walk_time, near_buildings, address, latitude, longitude, is_verified)
VALUES
('Oak Street Ramp', 'East Bank', 'Parking Garage', 2.50, '5 min to Coffman', 'Coffman Union, Walter Library, Carlson School, Northrop Auditorium', '401 SE Oak St, Minneapolis, MN 55455', 44.9739, -93.2312, TRUE),
('19th Ave Meters', 'East Bank', 'Street Parking', 1.50, '8 min to Keller', 'Keller Hall, Tate Lab, Recreation Center', '19th Ave SE & University Ave SE, Minneapolis, MN 55455', 44.9785, -93.2345, TRUE),
('Church Street Garage', 'East Bank', 'Parking Garage', 2.00, '3 min to Anderson', 'Anderson Hall, Bruininks Hall, Nicholson Hall', '80 Church St SE, Minneapolis, MN 55455', 44.9763, -93.2343, TRUE),
('4th St Ramp', 'East Bank', 'Parking Garage', 2.50, '7 min to Walter Library', 'Walter Library, Coffman Union', '1625 4th St SE, Minneapolis, MN 55455', 44.9806, -93.2355, TRUE),
('East River Road Garage', 'East Bank', 'Parking Garage', 1.00, '10 min to Northrop', 'Northrop Auditorium, Kolthoff Hall', '385 East River Pkwy, Minneapolis, MN 55455', 44.9732, -93.2392, TRUE),
('Washington Ave Bridge Lot', 'West Bank', 'Surface Lot', 1.00, '2 min to Wilson Library', 'Wilson Library, West Bank Buildings', '224 19th Ave S, Minneapolis, MN 55455', 44.9729, -93.2435, TRUE),
('21st Ave Ramp', 'West Bank', 'Parking Garage', 2.50, '4 min to Blegen', 'Blegen Hall, Ferguson Hall', '400 21st Ave S, Minneapolis, MN 55455', 44.9708, -93.2421, TRUE),
('19th Ave Ramp (West Bank)', 'West Bank', 'Parking Garage', 1.50, '5 min to Rarig', 'Rarig Center, West Bank Arts Buildings', '300 19th Ave S, Minneapolis, MN 55455', 44.9719, -93.2443, TRUE);

-- Insert Major Campus Mappings
INSERT INTO major_campus_mapping (major_name, major_category, primary_campus, common_buildings)
VALUES
-- STEM (mostly East Bank)
('Computer Science', 'STEM', 'East Bank', 'Keller Hall, Lind Hall'),
('Computer Engineering', 'STEM', 'East Bank', 'Keller Hall, EECS Building'),
('Mechanical Engineering', 'STEM', 'East Bank', 'ME Building'),
('Electrical Engineering', 'STEM', 'East Bank', 'EECS Building'),
('Civil Engineering', 'STEM', 'East Bank', 'Civil Engineering Building'),
('Biology', 'STEM', 'East Bank', 'Biological Sciences Center'),
('Chemistry', 'STEM', 'East Bank', 'Smith Hall, Kolthoff Hall'),
('Mathematics', 'STEM', 'East Bank', 'Vincent Hall'),
('Physics', 'STEM', 'East Bank', 'Tate Lab'),
('Data Science', 'STEM', 'East Bank', 'Keller Hall, Lind Hall'),
('Biochemistry', 'STEM', 'East Bank', 'Kolthoff Hall'),

-- Business (East Bank)
('Business', 'Business', 'East Bank', 'Carlson School of Management'),
('Accounting', 'Business', 'East Bank', 'Carlson School'),
('Finance', 'Business', 'East Bank', 'Carlson School'),
('Marketing', 'Business', 'East Bank', 'Carlson School'),

-- Liberal Arts & Social Sciences (Mixed)
('English', 'Liberal Arts', 'East Bank', 'Lind Hall, Folwell Hall'),
('History', 'Liberal Arts', 'West Bank', 'Social Sciences Building'),
('Psychology', 'Social Science', 'East Bank', 'Elliott Hall'),
('Sociology', 'Social Science', 'West Bank', 'Social Sciences Building'),
('Political Science', 'Social Science', 'West Bank', 'Blegen Hall'),
('Economics', 'Social Science', 'East Bank', 'Hanson Hall'),
('Philosophy', 'Liberal Arts', 'East Bank', 'Ford Hall'),

-- Arts (West Bank heavy)
('Theatre', 'Arts', 'West Bank', 'Rarig Center'),
('Music', 'Arts', 'East Bank', 'Ferguson Hall'),
('Art', 'Arts', 'West Bank', 'Regis Center for Art'),
('Dance', 'Arts', 'West Bank', 'Barbara Barker Center');

-- Verify everything was created
SELECT 'Parking Spots Count:' as Info, COUNT(*) as Count FROM parking_spots
UNION ALL
SELECT 'Major Mappings Count:', COUNT(*) FROM major_campus_mapping;

-- Show sample data
SELECT spot_id, spot_name, campus_location, cost FROM parking_spots LIMIT 5;
SELECT major_name, major_category, primary_campus FROM major_campus_mapping LIMIT 5;
