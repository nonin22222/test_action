const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// เรียกใช้อาวุธลับ (Stealth) เพื่อหลอก Cloudflare
puppeteer.use(StealthPlugin());

(async () => {
console.log("🚀 Launching Stealth Browser...");

const browser = await puppeteer.launch({
headless: "new", // โหมดไร้หน้าจอ (แบบใหม่)
args: [
'--no-sandbox',
'--disable-setuid-sandbox',
'--disable-dev-shm-usage',
'--disable-accelerated-2d-canvas',
'--no-first-run',
'--no-zygote',
'--disable-gpu'
]
});

try {
const page = await browser.newPage();

// ปลอมตัวเป็นคนใช้งานจริง
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

console.log("🌍 Navigating to Superrich API...");

// ยิงไปที่ API ลับที่คุณหามาได้ (ตัวนี้แหละ)
const apiUrl = "https://www.superrich1965.com/api/exchange-rate-service/v1/external-app-exchange-rate/get";

await page.goto(apiUrl, {
waitUntil: 'networkidle0', // รอจนกว่าเน็ตจะนิ่ง
timeout: 60000
});

// ดึงเนื้อหาจากหน้าเว็บ (ซึ่งควรจะเป็น JSON)
const content = await page.evaluate(() => document.body.innerText);

console.log("📦 Content received. Processing...");

let json;
try {
json = JSON.parse(content);
} catch (e) {
console.log("❌ Failed to parse JSON. Raw content:", content.substring(0, 100));
// ถ้าติด Cloudflare มันจะฟ้องตรงนี้
if (content.includes("Just a moment")) {
throw new Error("โดน Cloudflare ดักจับได้ (Stealth ยังเอาไม่อยู่ อาจต้องรอรันรอบหน้า)");
}
throw new Error("Invalid JSON response");
}

if (!json.data || !json.data.datas) {
throw new Error("โครงสร้าง JSON ไม่ตรงกับที่คาดหวัง");
}

const rates = json.data.datas;
console.log(`✅ Success! Found ${rates.length} currencies.`);

// แปลงข้อมูลให้สวยงาม
const finalRates = rates.map(item => ({
currency: item.currency_code,
buy: item.buying || 0,
sell: item.selling || 0
}));

// บันทึกไฟล์
const output = {
updated_at: new Date().toISOString(),
source: "Superrich 1965 (Node.js Stealth)",
data: finalRates
};

fs.writeFileSync('rates.json', JSON.stringify(output, null, 2));
console.log("💾 Saved to rates.json");

} catch (error) {
console.error("❌ Error:", error.message);
process.exit(1);
} finally {
await browser.close();
}
})();