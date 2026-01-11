<?php
// fetch_and_store.php

$api_url = "https://isot.okte.sk/api/v1/dam/results";
$db_file = "dam_data.db";

echo "[INFO] Spúšťam update...\n";

try {
    // Connect to SQLite database
    echo "[INFO] Pripájam sa k databáze: $db_file\n";
    $pdo = new PDO("sqlite:" . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "[OK] Pripojenie k databáze úspešné\n";

    // Get the last stored date
    $stmt = $pdo->query("SELECT MAX(deliveryDay) AS last_date FROM dam_results");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $last_date = $result['last_date'] ? $result['last_date'] : '2009-09-01';
    echo "[INFO] Posledný dátum v DB: $last_date\n";

    $start_date = date('Y-m-d', strtotime($last_date . ' +1 day'));
    $end_date = date('Y-m-d');

    // Check if it's after 13:00, then include next day in fetch
    if ((int) date('H') >= 13) {
        $end_date = date('Y-m-d', strtotime($end_date . ' +1 day'));
    }
    echo "[INFO] Rozsah dátumov: $start_date až $end_date\n";

    // Fetch data from API only for missing dates
    if ($start_date > $end_date) {
        echo "[INFO] Nie sú žiadne nové údaje\n";
        exit;
    }

    $api_request = "$api_url?deliveryDayFrom=$start_date&deliveryDayTo=$end_date";
    echo "[INFO] API URL: $api_request\n";

    // Check if cURL is available
    if (!function_exists('curl_init')) {
        throw new Exception("cURL nie je nainštalovaný! Povoľte php_curl v php.ini");
    }
    echo "[OK] cURL je dostupný\n";

    echo "[INFO] Volám API...\n";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_request);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlErrno = curl_errno($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);

    echo "[INFO] HTTP kód: $httpCode\n";
    echo "[INFO] Veľkosť odpovede: " . strlen($response) . " bajtov\n";

    if ($curlErrno !== 0) {
        echo "[ERROR] cURL errno: $curlErrno\n";
        echo "[ERROR] cURL error: $curlError\n";
        echo "[DEBUG] cURL info: " . print_r($curlInfo, true) . "\n";
        throw new Exception("cURL chyba ($curlErrno): $curlError");
    }

    if ($httpCode !== 200) {
        echo "[ERROR] Server vrátil HTTP $httpCode\n";
        echo "[DEBUG] Odpoveď servera (prvých 500 znakov): " . substr($response, 0, 500) . "\n";
        throw new Exception("HTTP chyba: $httpCode");
    }

    echo "[OK] API odpoveď prijatá\n";

    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo "[ERROR] JSON parse error: " . json_last_error_msg() . "\n";
        echo "[DEBUG] Prvých 500 znakov odpovede: " . substr($response, 0, 500) . "\n";
        throw new Exception("JSON parse error: " . json_last_error_msg());
    }

    if (!is_array($data)) {
        throw new Exception("API odpoveď nie je pole");
    }

    echo "[OK] JSON úspešne spracovaný, počet záznamov: " . count($data) . "\n";

    // Prepare SQL statement
    $stmt = $pdo->prepare(
        "INSERT INTO dam_results (
            deliveryDay, period, deliveryStart, deliveryEnd, publicationStatus, 
            price, purchaseTotalVolume, purchaseSuccessfulVolume, purchaseUnsuccessfulVolume, 
            saleTotalVolume, saleSuccessfulVolume, saleUnsuccessfulVolume, 
            priceRo, priceHu, priceCz, 
            atcSkCz, atcCzSk, atcSkPl, atcPlSk, atcSkPlc, atcPlcSk, 
            atcSkHu, atcHuSk, atcHuRo, atcRoHu, 
            flowSkCz, flowCzSk, flowSkPl, flowPlSk, flowSkPlc, flowPlcSk, 
            flowSkHu, flowHuSk, flowHuRo, flowRoHu
        ) VALUES (
            :deliveryDay, :period, :deliveryStart, :deliveryEnd, :publicationStatus, 
            :price, :purchaseTotalVolume, :purchaseSuccessfulVolume, :purchaseUnsuccessfulVolume, 
            :saleTotalVolume, :saleSuccessfulVolume, :saleUnsuccessfulVolume, 
            :priceRo, :priceHu, :priceCz, 
            :atcSkCz, :atcCzSk, :atcSkPl, :atcPlSk, :atcSkPlc, :atcPlcSk, 
            :atcSkHu, :atcHuSk, :atcHuRo, :atcRoHu, 
            :flowSkCz, :flowCzSk, :flowSkPl, :flowPlSk, :flowSkPlc, :flowPlcSk, 
            :flowSkHu, :flowHuSk, :flowHuRo, :flowRoHu
        )"
    );

    // Insert data into database
    echo "[INFO] Vkladám záznamy do databázy...\n";
    $inserted = 0;
    $errors = 0;

    foreach ($data as $index => $entry) {
        try {
            $stmt->execute([
                ':deliveryDay' => $entry['deliveryDay'],
                ':period' => $entry['period'],
                ':deliveryStart' => $entry['deliveryStart'],
                ':deliveryEnd' => $entry['deliveryEnd'],
                ':publicationStatus' => $entry['publicationStatus'],
                ':price' => $entry['price'],
                ':purchaseTotalVolume' => $entry['purchaseTotalVolume'],
                ':purchaseSuccessfulVolume' => $entry['purchaseSuccessfulVolume'],
                ':purchaseUnsuccessfulVolume' => $entry['purchaseUnsuccessfulVolume'],
                ':saleTotalVolume' => $entry['saleTotalVolume'],
                ':saleSuccessfulVolume' => $entry['saleSuccessfulVolume'],
                ':saleUnsuccessfulVolume' => $entry['saleUnsuccessfulVolume'],
                ':priceRo' => $entry['priceRo'],
                ':priceHu' => $entry['priceHu'],
                ':priceCz' => $entry['priceCz'],
                ':atcSkCz' => $entry['atcSkCz'],
                ':atcCzSk' => $entry['atcCzSk'],
                ':atcSkPl' => $entry['atcSkPl'],
                ':atcPlSk' => $entry['atcPlSk'],
                ':atcSkPlc' => $entry['atcSkPlc'],
                ':atcPlcSk' => $entry['atcPlcSk'],
                ':atcSkHu' => $entry['atcSkHu'],
                ':atcHuSk' => $entry['atcHuSk'],
                ':atcHuRo' => $entry['atcHuRo'],
                ':atcRoHu' => $entry['atcRoHu'],
                ':flowSkCz' => $entry['flowSkCz'],
                ':flowCzSk' => $entry['flowCzSk'],
                ':flowSkPl' => $entry['flowSkPl'],
                ':flowPlSk' => $entry['flowPlSk'],
                ':flowSkPlc' => $entry['flowSkPlc'],
                ':flowPlcSk' => $entry['flowPlcSk'],
                ':flowSkHu' => $entry['flowSkHu'],
                ':flowHuSk' => $entry['flowHuSk'],
                ':flowHuRo' => $entry['flowHuRo'],
                ':flowRoHu' => $entry['flowRoHu']
            ]);
            $inserted++;
        } catch (PDOException $e) {
            $errors++;
            if ($errors <= 5) {
                echo "[WARN] Chyba pri vkladaní záznamu #$index ({$entry['deliveryDay']} period {$entry['period']}): " . $e->getMessage() . "\n";
            }
        }

        // Progress indicator every 100 records
        if (($index + 1) % 100 === 0) {
            echo "[INFO] Spracovaných: " . ($index + 1) . "/" . count($data) . "\n";
        }
    }

    echo "[OK] Hotovo! Vložených: $inserted, chýb: $errors\n";
} catch (Exception $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";
    echo "[DEBUG] Stack trace:\n" . $e->getTraceAsString() . "\n";
}
?>
