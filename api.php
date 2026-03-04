<?php
// Hide PHP warnings so they don't break our JSON output
error_reporting(E_ALL & ~E_DEPRECATED & ~E_WARNING);

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");

try {
    $db = new PDO('sqlite:database.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $db->exec("CREATE TABLE IF NOT EXISTS holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        image TEXT
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holiday_id INTEGER,
        type TEXT,
        icon TEXT,
        title TEXT,
        details TEXT,
        raw_json TEXT
    )");

    $action = $_GET['action'] ?? '';

    // --- Get Holidays ---
    if ($action === 'get_holidays') {
        $stmt = $db->query("SELECT * FROM holidays ORDER BY id DESC");
        $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($holidays as &$holiday) {
            $bookingStmt = $db->prepare("SELECT * FROM bookings WHERE holiday_id = ?");
            $bookingStmt->execute([$holiday['id']]);
            $holiday['bookings'] = $bookingStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode($holidays);
        exit;
    }

    // --- Delete Holiday ---
    if ($action === 'delete_holiday' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        if (empty($data['id'])) { echo json_encode(["status" => "error"]); exit; }
        
        $stmt = $db->prepare("DELETE FROM holidays WHERE id = ?");
        $stmt->execute([$data['id']]);
        $stmtBookings = $db->prepare("DELETE FROM bookings WHERE holiday_id = ?");
        $stmtBookings->execute([$data['id']]);
        
        echo json_encode(["status" => "success"]);
        exit;
    }

    // --- Save Manual ---
    if ($action === 'save_manual' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        if (!$data || empty($data['title'])) { echo json_encode(["status" => "error"]); exit; }
        
        $isEdit = !empty($data['id']);
        $holidayId = null;

        if ($isEdit) {
            $holidayId = $data['id'];
            $stmt = $db->prepare("UPDATE holidays SET title = ? WHERE id = ?");
            $stmt->execute([$data['title'], $holidayId]);
            $delStmt = $db->prepare("DELETE FROM bookings WHERE holiday_id = ?");
            $delStmt->execute([$holidayId]);
        } else {
            // UPDATED: A curated list of stunning Unsplash travel photos to prevent random forks!
            $travelImages = [
                "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80", // Paris
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80", // Tropical Beach
                "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80", // Resort
                "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80", // Mountain Lake
                "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=800&q=80", // Venice Canals
                "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80", // Kyoto/Japan
                "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&w=800&q=80", // London
                "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80", // Dubai
                "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=800&q=80"  // Desert/Camels
            ];
            $holidayImage = $travelImages[array_rand($travelImages)];

            $stmt = $db->prepare("INSERT INTO holidays (title, image) VALUES (?, ?)");
            $stmt->execute([$data['title'], $holidayImage]);
            $holidayId = $db->lastInsertId();
        }

        if (!empty($data['flights'])) {
            $flightStmt = $db->prepare("INSERT INTO bookings (holiday_id, type, icon, title, details, raw_json) VALUES (?, 'flight', '✈️', ?, ?, ?)");
            foreach ($data['flights'] as $flight) {
                $details = $flight['date'] . ' - ' . $flight['origin'] . ' to ' . $flight['destination'] . (!empty($flight['ref']) ? ' (Ref: ' . $flight['ref'] . ')' : '');
                $flightStmt->execute([$holidayId, $flight['airline'], $details, json_encode($flight)]);
            }
        }

        if (!empty($data['hotels'])) {
            $hotelStmt = $db->prepare("INSERT INTO bookings (holiday_id, type, icon, title, details, raw_json) VALUES (?, 'hotel', '🏨', ?, ?, ?)");
            foreach ($data['hotels'] as $hotel) {
                $details = $hotel['checkIn'] . ' to ' . $hotel['checkOut'] . (!empty($hotel['ref']) ? ' (Ref: ' . $hotel['ref'] . ')' : '');
                $hotelStmt->execute([$holidayId, $hotel['name'], $details, json_encode($hotel)]);
            }
        }
        echo json_encode(["status" => "success"]);
        exit;
    }

    // --- MAGIC AI ENDPOINT ---
    if ($action === 'extract_ai' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        
        $apiKey = 'AIzaSyDNLYnY0mx8Lwi-keuwrgm2WHRSFYXMeQ4'; 

        $prompt = "You are a travel parsing API. I will give you a raw booking email and a JSON list of my existing trips.
        1. Extract ALL bookings (flights and/or hotels) from the email. Format all dates to YYYY-MM-DD.
        2. SMART GROUPING: Check the new booking dates against my existing trips. If the new bookings fall within or adjacent to an existing trip, return that trip's ID in the 'holiday_id' field. If they do not overlap with ANY existing trip, return null for 'holiday_id' and suggest a title for a new holiday.
        3. Return STRICTLY JSON with this exact schema:
        {
          \"holiday_id\": 12 (or null),
          \"suggested_title\": \"Trip to Paris\",
          \"flights\": [
            {\"airline\": \"\", \"origin\": \"\", \"destination\": \"\", \"date\": \"YYYY-MM-DD\", \"ref\": \"\"}
          ],
          \"hotels\": [
            {\"name\": \"\", \"checkIn\": \"YYYY-MM-DD\", \"checkOut\": \"YYYY-MM-DD\", \"ref\": \"\"}
          ]
        }
        
        My Existing Trips: " . json_encode($data['existing_holidays'] ?? []) . "
        Raw Email To Parse: " . ($data['email'] ?? '');

        $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $apiKey;
        
        $payload = json_encode([
            "contents" => [["parts" => [["text" => $prompt]]]],
            "generationConfig" => ["responseMimeType" => "application/json"]
        ]);

        $ch = curl_init($geminiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        
        $response = curl_exec($ch);
        $err = curl_error($ch);
        
        if ($response === false) {
            echo json_encode(["status" => "error", "message" => "Server cURL Error: " . $err]);
            exit;
        }

        $geminiData = json_decode($response, true);
        
        if (isset($geminiData['error'])) {
            echo json_encode(["status" => "error", "message" => "Google AI Error: " . $geminiData['error']['message']]);
            exit;
        }

        $textResult = $geminiData['candidates'][0]['content']['parts'][0]['text'] ?? null;
        
        if (!$textResult) {
            echo json_encode(["status" => "error", "message" => "Gemini returned empty data."]);
            exit;
        }
        
        $cleanJson = preg_replace('/^```json\s*|```$/m', '', $textResult);
        
        if (ob_get_length()) ob_clean();
        echo trim($cleanJson);
        exit;
    }
} catch (PDOException $e) { echo json_encode(["status" => "error", "message" => $e->getMessage()]); }
?>