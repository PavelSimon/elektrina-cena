<?php
// fetch_and_store.php

$api_url = "https://isot.okte.sk/api/v1/dam/results";
$db_file = "dam_data.db";

try {
    // Connect to SQLite database
    $pdo = new PDO("sqlite:" . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Get the last stored date
    $stmt = $pdo->query("SELECT MAX(deliveryDay) AS last_date FROM dam_results");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $last_date = $result['last_date'] ? $result['last_date'] : '2009-09-01';
    $start_date = date('Y-m-d', strtotime($last_date . ' +1 day'));
    $end_date = date('Y-m-d');

    // Check if it's after 13:00, then include next day in fetch
    if ((int) date('H') >= 13) {
        $end_date = date('Y-m-d', strtotime($end_date . ' +1 day'));
    }

    // Fetch data from API only for missing dates
    if ($start_date > $end_date) {
        echo "Nie sú žiadne nové údaje";
        exit;
    }

    $api_request = "$api_url?deliveryDayFrom=$start_date&deliveryDayTo=$end_date";
    print_r($api_request . "\n");

    $options = [
        "http" => [
            "method" => "GET",
            "header" => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\r\n" .
                "Accept: application/json\r\n"
        ],
        "ssl" => [
            "verify_peer" => false,
            "verify_peer_name" => false,
        ]
    ];
    $context = stream_context_create($options);

    $response = file_get_contents($api_request, false, $context);
    if ($response === false) {
        $error = error_get_last();
        throw new Exception("Failed to fetch data from API. PHP Error: " . $error['message']);
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        throw new Exception("Invalid API response format.");
    }

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
    foreach ($data as $entry) {
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
    }

    echo "Data successfully fetched and stored.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
