<?php
// Proxy cez creativespace.sk (OKTE blokuje hosting)
$api_url = "https://creativespace.sk/bakalarky/proxy.php";
$db_file = "dam_data.db";

try {
    $pdo = new PDO("sqlite:" . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

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
            curl_close($ch);
        }
    }

    if ($response === false || strlen($response) === 0) {
        throw new Exception("Nepodarilo sa ziskat data z API");
    }

    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON parse error: " . json_last_error_msg());
    }

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

    $inserted = 0;
    foreach ($data as $entry) {
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
            // Skip duplicates
        }
    }

    echo "Vlozených: $inserted\n";
} catch (Exception $e) {
    echo "Chyba: " . $e->getMessage() . "\n";
}
