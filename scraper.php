<?php
// ชื่อไฟล์: scraper.php

require __DIR__ . '/vendor/autoload.php'; // บรรทัดนี้สำคัญมาก ห้ามลบ

use Symfony\Component\Panther\Client;

// เริ่มต้น Client
$client = Client::createChromeClient();
// หรือถ้าอยากกำหนด Argument เพิ่มเติม
// $client = Client::createChromeClient(null, ['--no-sandbox', '--disable-dev-shm-usage']);

try {
    echo "Processing...\n";

    // 1. ไปที่เว็บ
    $crawler = $client->request('GET', 'https://www.superrich1965.com/th');

    // 2. รอโหลด
    $client->waitFor('.currency-wrapper');

    // 3. ดึงข้อมูล
    $rates = [];
    $crawler->filter('.currency-wrapper')->each(function ($node) use (&$rates) {
        try {
            $currency = $node->filter('.english-text')->first()->text();

            // หาเรทราคา
            $rateNodes = $node->filter('.text-main[style*="text-align: end"]');

            if ($rateNodes->count() >= 2) {
                $buyRate = floatval($rateNodes->eq(0)->text());
                $sellRate = floatval($rateNodes->eq(1)->text());

                if ($buyRate > 0) {
                    $rates[] = [
                        'currency' => trim($currency),
                        'buy' => $buyRate,
                        'sell' => $sellRate
                    ];
                }
            }
        } catch (Exception $e) {
        }
    });

    // 4. สร้าง Array ผลลัพธ์
    $result = [
        'updated_at' => date('Y-m-d H:i:s'),
        'data' => $rates
    ];

    // *** จุดสำคัญ: บันทึกลงไฟล์ชื่อ rates.json ***
    file_put_contents('rates.json', json_encode($result, JSON_UNESCAPED_UNICODE));
    echo "✅ Success! Saved to rates.json";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
    exit(1); // ส่งค่า Error ให้ GitHub รู้
}
