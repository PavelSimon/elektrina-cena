<?php
// proxy.php - nahrat na creativespace.sk
header('Content-Type: application/json');

$from = $_GET['from'] ?? '';
$to = $_GET['to'] ?? '';

if (!$from || !$to) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing from/to parameters']);
    exit;
}

$api_url = "https://isot.okte.sk/api/v1/dam/results?deliveryDayFrom=" . urlencode($from) . "&deliveryDayTo=" . urlencode($to);

$ch = curl_init($api_url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => ['Accept: application/json']
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200 && $response) {
    echo $response;
} else {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch from OKTE API', 'http_code' => $httpCode]);
}
