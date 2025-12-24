<?php

require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Panther\Client;

echo "🚀 Launching Chrome (Headless Stealth Mode)...\n";

// การตั้งค่า Chrome สำหรับ Server ที่ไม่มีหน้าจอ (GitHub Actions)
$args = [
    '--headless', // 👈 สำคัญมาก! ต้องบอกว่ารันแบบไม่ใช้จอ ไม่งั้น Chrome จะแครช
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080', // หลอกว่าจอใหญ่
    '--disable-blink-features=AutomationControlled', // ปิดการบอกว่าเป็นบอท
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// สร้าง Client
$client = Client::createChromeClient(null, $args);

try {
    echo "🌍 Opening website...\n";
    $client->request('GET', 'https://www.superrich1965.com/th');

    // รอโหลดสักพัก
    echo "⏳ Waiting for content...\n";
    sleep(10);

    // แคปหน้าจอส่งมาให้ดูหน่อย (เผื่อยัง Error อีกจะได้เห็นภาพ)
    $client->takeScreenshot('debug_screen.png');
    echo "📸 Screenshot taken.\n";

    // ค้นหาตาราง (รอสูงสุด 20 วินาที)
    $crawler = $client->waitFor('.currency-wrapper', 20);

    $rates = [];
    $crawler->filter('.currency-wrapper')->each(function ($node) use (&$rates) {
        try {
            $currency = $node->filter('.english-text')->text();

            // ดึงเรทซื้อ-ขาย
            $rateNodes = $node->filter('.text-main[style*="text-align: end"]');

            if ($rateNodes->count() >= 2) {
                $buy = $rateNodes->eq(0)->text();
                $sell = $rateNodes->eq(1)->text();

                $rates[] = [
                    'currency' => trim($currency),
                    'buy' => $buy,
                    'sell' => $sell
                ];
            }
        } catch (Exception $e) {
        }
    });

    if (empty($rates)) {
        throw new Exception("เปิดเว็บได้แต่หาตารางไม่เจอ (ดูรูป debug_screen.png)");
    }

    // บันทึกไฟล์
    $result = [
        'updated_at' => date('Y-m-d H:i:s'),
        'data' => $rates
    ];

    file_put_contents('rates.json', json_encode($result, JSON_UNESCAPED_UNICODE));
    echo "✅ Success! Saved " . count($rates) . " currencies.";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";

    // ถ้าพัง ให้ลองแคปหน้าจอตอนพังมาด้วย
    try {
        $client->takeScreenshot('error_screen.png');
    } catch (Exception $ex) {
    }

    exit(1);
}
