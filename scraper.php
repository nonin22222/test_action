<?php

require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Panther\Client;
use Facebook\WebDriver\Chrome\ChromeOptions;

echo "🚀 Launching Stealth Chrome...\n";

// ตั้งค่า Chrome ให้เหมือนคนที่สุด (Stealth Mode)
$args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled', // 👈 ตัวสำคัญ! ปิดการบอกว่าเป็นบอท
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

$client = Client::createChromeClient(null, $args);

try {
    // 1. เข้าเว็บ
    echo "opening website...\n";
    $client->request('GET', 'https://www.superrich1965.com/th');

    // 2. รอโหลด (รอนานหน่อยเผื่อเน็ตช้า)
    sleep(10);

    // ** แคปหน้าจอมาดูหน่อย ว่าเปิดเจออะไร **
    $client->takeScreenshot('debug_screen.png');
    echo "📸 Screenshot taken (debug_screen.png)\n";

    // 3. ลองหาตาราง
    $crawler = $client->waitFor('.currency-wrapper', 15); // รอ element นี้ 15 วิ

    $rates = [];
    $crawler->filter('.currency-wrapper')->each(function ($node) use (&$rates) {
        try {
            $currency = $node->filter('.english-text')->text();
            $buy = $node->filter('.text-main')->eq(0)->text(); // ต้องเช็ค index ดีๆ
            $sell = $node->filter('.text-main')->eq(1)->text();

            $rates[] = [
                'currency' => trim($currency),
                'buy' => $buy,
                'sell' => $sell
            ];
        } catch (Exception $e) {
        }
    });

    if (empty($rates)) {
        throw new Exception("หาตารางไม่เจอ (ดูรูป debug_screen.png เพื่อหาสาเหตุ)");
    }

    // 4. บันทึก
    $result = [
        'updated_at' => date('Y-m-d H:i:s'),
        'data' => $rates
    ];
    file_put_contents('rates.json', json_encode($result, JSON_UNESCAPED_UNICODE));
    echo "✅ Success! Saved rates.json";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    // แคปหน้าจอตอน Error ไว้ด้วย
    $client->takeScreenshot('error_screen.png');
    exit(1);
}
