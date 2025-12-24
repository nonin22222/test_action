<?php

require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Panther\Client;

echo "🚀 Starting Scraper (Headless Mode)...\n";

// ตั้งค่า Chrome ให้ทำงานบน Server ไม่มีจอได้ (Headless)
// และใส่ค่าหลอกว่าเป็นคน (Stealth)
$args = [
    '--headless', // 👈 ตัวสำคัญที่สุด! ต้องมีบรรทัดนี้
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled', // ปิดจุดสังเกตบอท
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// สร้าง Client
$client = Client::createChromeClient(null, $args);

try {
    echo "🌍 Opening Superrich 1965...\n";
    $client->request('GET', 'https://www.superrich1965.com/th');

    // รอโหลดข้อมูล (AJAX)
    echo "⏳ Waiting for data (15s)...\n";
    sleep(15);

    // แคปหน้าจอเก็บไว้ดู (เผื่อพังจะได้รู้ว่าเปิดเจอหน้าอะไร)
    $client->takeScreenshot('debug_screen.png');
    echo "📸 Screenshot taken.\n";

    // พยายามหาตาราง
    // หมายเหตุ: ถ้าหน้าเว็บเปลี่ยน Class ตัวนี้อาจจะหาไม่เจอ
    $crawler = $client->waitFor('.currency-wrapper', 10);

    $rates = [];
    $crawler->filter('.currency-wrapper')->each(function ($node) use (&$rates) {
        try {
            $currency = $node->filter('.english-text')->text();

            // หาเรท ซื้อ-ขาย
            $rateNodes = $node->filter('.text-main[style*="text-align: end"]');

            if ($rateNodes->count() >= 2) {
                $rates[] = [
                    'currency' => trim($currency),
                    'buy' => $rateNodes->eq(0)->text(),
                    'sell' => $rateNodes->eq(1)->text()
                ];
            }
        } catch (Exception $e) {
        }
    });

    if (empty($rates)) {
        throw new Exception("เปิดเว็บได้ แต่ดึงข้อมูลไม่เจอ (ดูรูป debug_screen.png)");
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

    // ถ้าพัง ให้แคปหน้าจอตอนพังไว้ด้วย
    try {
        $client->takeScreenshot('error_screen.png');
    } catch (Exception $ex) {
    }

    exit(1);
}
