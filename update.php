<?php
// Proxy cez creativespace.sk (OKTE blokuje hosting)
$api_url = "https://creativespace.sk/bakalarky/proxy.php";
$db_file = "dam_data.db";

try {
    $pdo = new PDO("sqlite:" . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Jednorazovo: UNIQUE index na (deliveryDay, period). Brani duplicitam a zrychluje api.php.
    $has_index = $pdo->query(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_dam_day_period'"
    )->fetchColumn();
    if (!$has_index) {
        $pdo->beginTransaction();
        // Pripadne existujuce duplicity (ponecha sa najstarsi zaznam), inak by index nevznikol
        $pdo->exec(
            "DELETE FROM dam_results WHERE id NOT IN (
                SELECT MIN(id) FROM dam_results GROUP BY deliveryDay, period
            )"
        );
        $pdo->exec("CREATE UNIQUE INDEX idx_dam_day_period ON dam_results (deliveryDay, period)");
        $pdo->commit();
    }

    $stmt = $pdo->query("SELECT MAX(deliveryDay) AS last_date FROM dam_results");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $last_date = $result['last_date'] ? $result['last_date'] : '2009-09-01';

    $start_date = date('Y-m-d', strtotime($last_date . ' +1 day'));
    $end_date = date('Y-m-d');

    if ((int) date('H') >= 13) {
        $end_date = date('Y-m-d', strtotime($end_date . ' +1 day'));
    }

    if ($start_date > $end_date) {
        echo "Nie su ziadne nove udaje\n";
        exit;
    }

    $api_request = "$api_url?from=$start_date&to=$end_date";

    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\n",
            'timeout' => 120
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ];
    $context = stream_context_create($opts);
    $response = @file_get_contents($api_request, false, $context);

    if ($response === false || strlen($response) === 0) {
        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $api_request,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT => 120,
                CURLOPT_HTTPHEADER => ['Accept: application/json']
            ]);
            $response = curl_exec($ch);
        }
    }

    if ($response === false || strlen($response) === 0) {
        throw new Exception("Nepodarilo sa ziskat data z API");
    }

    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON parse error: " . json_last_error_msg());
    }

    // Proxy pri chybe vracia objekt {"error": ..., "http_code": ...}, nie zoznam zaznamov
    if (!is_array($data) || isset($data['error'])) {
        $msg = is_array($data) ? $data['error'] : 'neocakavana odpoved';
        if (is_array($data) && isset($data['http_code'])) {
            $msg .= " (OKTE HTTP " . $data['http_code'] . ")";
            if ((int) $data['http_code'] === 503) {
                $msg .= " - OKTE je docasne nedostupne (udrzba), skuste neskor";
            }
        }
        throw new Exception($msg);
    }

    $stmt = $pdo->prepare(
        "INSERT OR IGNORE INTO dam_results (
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

    $inserted = 0;
    foreach ($data as $entry) {
        if (!is_array($entry) || !isset($entry['deliveryDay'])) {
            continue;
        }
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
            // Duplicitny (deliveryDay, period) sa vdaka OR IGNORE preskoci, rowCount je vtedy 0
            $inserted += $stmt->rowCount();
        } catch (PDOException $e) {
            // Chybny zaznam preskocime, ostatne sa vlozia
        }
    }

    echo "Vlozených: $inserted\n";
} catch (Exception $e) {
    echo "Chyba: " . $e->getMessage() . "\n";
}
