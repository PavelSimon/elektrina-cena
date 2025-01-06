<?php
// api.php
header('Content-Type: application/json');

$start_date = isset($_GET['start_date']) ? $_GET['start_date'] : '2009-09-01';
$end_date = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');

try {
    $pdo = new PDO('sqlite:dam_data.db');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare(
        "SELECT deliveryDay, period, price FROM dam_results WHERE deliveryDay BETWEEN :start_date AND :end_date ORDER BY deliveryDay, period"
    );
    $stmt->execute([':start_date' => $start_date, ':end_date' => $end_date]);

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($data);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
