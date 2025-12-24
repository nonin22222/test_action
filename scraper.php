<?php

// URL ที่คุณเพิ่งแกะได้มา (ตัวนี้แม่นยำสุด)
$url = "https://www.superrich1965.com/api/exchange-rate-service/v1/external-app-exchange-rate/get";

echo "🚀 Connecting to Superrich API (Spoofing Headers)...\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

// --- 💡 หัวใจสำคัญ: ชุด Header สำหรับปลอมตัว ---
// ต้องใส่ให้ครบ เพื่อหลอก Server ว่าเราคือคนกดดูผ่านหน้าเว็บจริงๆ ไม่ใช่ Postman
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer: https://www.superrich1965.com/',
    'Origin: https://www.superrich1965.com',
    'Accept: application/json, text/plain, */*',
    'Content-Type: application/json',
    'apikey: ' // บางทีอาจต้องมีค่าว่างๆ หรือถ้าใน Network tab มี apikey ก็ก๊อปมาใส่ตรงนี้ได้
]);

curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// เช็คผลลัพธ์
if ($httpCode !== 200) {
    echo "❌ เข้าไม่ได้ (HTTP $httpCode)\n";
    echo "Response: " . substr($response, 0, 200) . "...\n";
    exit(1);
}

$result = json_decode($response, true);

// เช็คโครงสร้าง JSON ตามที่คุณให้มา (ข้อมูลมันซ่อนอยู่ใน 'datas')
if (empty($result) || !isset($result['data']['datas'])) {
    echo "❌ ไม่พบข้อมูล (โครงสร้าง JSON อาจเปลี่ยน)\n";
    // ลองปริ้นโครงสร้างออกมาดูหน่อย
    print_r($result);
    exit(1);
}

$raw_rates = $result['data']['datas'];
echo "✅ เจาะผ่านสำเร็จ! พบข้อมูล " . count($raw_rates) . " สกุลเงิน\n";

// --- แปลงข้อมูลให้สวยงาม พร้อมใช้ ---
$final_rates = [];

foreach ($raw_rates as $item) {
    $currency = $item['currency_code'];

    // หาเรท (API นี้มักจะส่งเรทมาเป็นช่วงๆ เราเลือกตัวแรกหรือตัวที่ใช้บ่อย)
    // ตรงนี้ต้องดูโครงสร้างข้างใน 'datas' อีกทีว่ามันเก็บตัวเลขที่ field ไหน
    // สมมติว่ามันชื่อ 'buying' กับ 'selling' (ต้องปรับตามจริงถ้าชื่อ field ไม่ตรง)
    $buy = $item['buying'] ?? 0;
    $sell = $item['selling'] ?? 0;

    // กรณีที่มันซ้อน array ลึกเข้าไปอีก เช่น $item['rates'][0]['buying']
    // (ถ้า Run แล้วเลขเป็น 0 ให้ดูไฟล์ rates.json แล้วมาแก้บรรทัดนี้ครับ)

    $final_rates[] = [
        'currency' => $currency,
        'buy' => $buy,
        'sell' => $sell
    ];
}

// บันทึกลงไฟล์
$output = [
    'updated_at' => date('Y-m-d H:i:s'),
    'source' => 'Superrich 1965 (External API)',
    'data' => $final_rates,
    'raw_debug' => $result // แถมข้อมูลดิบไว้แกะดูด้วย
];

file_put_contents('rates.json', json_encode($output, JSON_UNESCAPED_UNICODE));
echo "💾 Saved to rates.json";
