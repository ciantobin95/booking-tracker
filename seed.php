<?php
// 1. Connect to our new SQLite database
$db = new PDO('sqlite:database.sqlite');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "Connected to database...<br>";

// 2. Clear out any old data (so we don't get duplicates if you run this twice)
$db->exec("DELETE FROM holidays");
$db->exec("DELETE FROM bookings");

// 3. Insert Holiday 1: Rome
$db->exec("INSERT INTO holidays (title, image) VALUES ('Summer in Rome', 'https://images.unsplash.com/photo-1588614959060-4d144f28b207?auto=format&fit=crop&w=800&q=80')");

$rome_id = $db->lastInsertId(); // Gets the ID of the Rome holiday we just created
// Insert Rome Bookings using that ID
$db->exec("INSERT INTO bookings (holiday_id, type, icon, title, details) VALUES ($rome_id, 'flight', '✈️', 'Ryanair (FR 1234)', '12 Aug, 10:00 AM - DUB to CIA')");
$db->exec("INSERT INTO bookings (holiday_id, type, icon, title, details) VALUES ($rome_id, 'hotel', '🏨', 'Hotel Colosseum', '12 Aug - 19 Aug (Ref: XYZ789)')");

// 4. Insert Holiday 2: Kyoto
$db->exec("INSERT INTO holidays (title, image) VALUES ('Winter in Kyoto', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80')");
$kyoto_id = $db->lastInsertId();

// Insert Kyoto Bookings using that ID
$db->exec("INSERT INTO bookings (holiday_id, type, icon, title, details) VALUES ($kyoto_id, 'flight', '✈️', 'Emirates (EK 11)', '10 Nov, 14:00 PM - DUB to KIX')");
$db->exec("INSERT INTO bookings (holiday_id, type, icon, title, details) VALUES ($kyoto_id, 'hotel', '🏨', 'Ryokan Koto', '11 Nov - 18 Nov (Ref: JPN123)')");

echo "✅ Database seeded successfully! You now have real data in your SQLite file.";
?>