<?php

require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Panther\Client;

// 1. ตั้งค่าการปลอมตัว (User-Agent) ให้เหมือนคนใช้ Windows + Chrome จริงๆ
$args = [
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

$client = Client::createChromeClient(null, $args);

try {
    echo "Processing...\n";

    // 2. เข้าเว็บ
    $crawler = $client->request('GET', 'https://www.superrich1965.com/th');

    // 3. รอโหลด (เพิ่มเวลาเป็น 60 วินาที กันพลาด)
    // และเปลี่ยนตัวจับ เป็นตัวที่หาง่ายกว่า
    $client->waitFor('.currency-wrapper', 60);

    // 4. ดึงข้อมูล
    $rates = [];
    $crawler->filter('.currency-wrapper')->each(function ($node) use (&$rates) {
        try {
            $currency = $node->filter('.english-text')->count() ? $node->filter('.english-text')->text() : '';
            $rateNodes = $node->filter('.text-main[style*="text-align: end"]');

            if ($rateNodes->count() >= 2 && !empty($currency)) {
                $buy = floatval($rateNodes->eq(0)->text());
                $sell = floatval($rateNodes->eq(1)->text());

                if ($buy > 0) {
                    $rates[] = [
                        'currency' => trim($currency),
                        'buy' => $buy,
                        'sell' => $sell
                    ];
                }
            }
        } catch (Exception $e) {
        }
    });

    // เช็คว่าได้ข้อมูลมาจริงไหม
    if (empty($rates)) {
        throw new Exception("เข้าเว็บได้ แต่หาข้อมูลไม่เจอ (อาจจะโดนเปลี่ยนหน้าเว็บ)");
    }

    $result = [
        'updated_at' => date('Y-m-d H:i:s'),
        'data' => $rates
    ];

    file_put_contents('rates.json', json_encode($result, JSON_UNESCAPED_UNICODE));
    echo "✅ Success! Saved " . count($rates) . " currencies to rates.json";
} catch (Exception $e) {
    // ถ้าพัง ให้ปริ้น Error ออกมาดู
    echo "❌ Failed: " . $e->getMessage();
    exit(1);
}
