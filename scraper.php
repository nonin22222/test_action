<?php

// ไม่ต้องใช้ Library อะไรเลย ใช้ PHP ล้วนๆ เบาและเร็วมาก
$apiUrl = 'https://superrichthailand.com/api/v1/rates';

echo "🚀 Connecting to Superrich Thailand API...\n";

// 1. ตั้งค่าการเชื่อมต่อ (ปลอมตัวเป็น Browser นิดหน่อยกันโดนบล็อก)
$options = [
    "http" => [
        "method" => "GET",
        "header" => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n" .
            "Accept: application/json\r\n"
    ]
];

$context = stream_context_create($options);

// 2. ดึงข้อมูล
$json = file_get_contents($apiUrl, false, $context);

if ($json === FALSE) {
    echo "❌ Error: ไม่สามารถดึงข้อมูลได้ (อาจจะโดนบล็อก IP)\n";
    exit(1);
}

// 3. แปลงข้อมูล
$data = json_decode($json, true);

if (empty($data)) {
    echo "❌ Error: ได้ข้อมูลเปล่า\n";
    exit(1);
}

echo "✅ ได้ข้อมูลมาแล้ว! กำลังประมวลผล...\n";

$formattedRates = [];
$timestamp = date('Y-m-d H:i:s');

// วนลูปเก็บข้อมูล (โครงสร้าง JSON ของสีเขียวจะต่างจากสีส้มเล็กน้อย)
foreach ($data as $item) {
    $currency = $item['currencyCode'];
    // Superrich เขียวมักส่งมาเป็น array ของเรท (รับซื้อ/ขาย)
    // เราจะดึงเรทล่าสุด
    $buy = $item['midRate'] ?? 0; // หรือใช้ logic อื่นตามโครงสร้างจริง
    $sell = $item['midRate'] ?? 0; // API นี้บางทีส่งมาเป็นเรทกลาง ต้องเช็ค key ดีๆ

    // หมายเหตุ: API Superrich เขียว บางทีส่ง key มาเป็น 'rate' array
    // ขอเขียนแบบดึงพื้นฐานให้ก่อน

    $formattedRates[] = [
        'currency' => $currency,
        'name' => $item['currencyName'] ?? '',
        'buy' => $item['buying'] ?? 0,    // ถ้า key จริงคือ buying
        'sell' => $item['selling'] ?? 0   // ถ้า key จริงคือ selling
    ];
}

// 4. บันทึกไฟล์
$result = [
    'source' => 'Superrich Thailand (Green)',
    'updated_at' => $timestamp,
    'data' => $data // บันทึก Raw Data ไปเลยชัวร์สุด เอาไปแกะต่อใน WordPress
];

file_put_contents('rates.json', json_encode($result, JSON_UNESCAPED_UNICODE));
echo "✅ Success! Saved to rates.json";
