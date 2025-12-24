const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
  console.log("🚀 Launching Stealth Browser (Debug Mode)...");

  const browser = await puppeteer.launch({
    headless: "new",
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // API URL เดิมของคุณ
    const apiUrl = "https://www.superrich1965.com/api/exchange-rate-service/v1/external-app-exchange-rate/get";
    
    console.log("🌍 Navigating to URL...");
    await page.goto(apiUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    const content = await page.evaluate(() => document.body.innerText);

    console.log("📦 Received Data (First 1000 characters):");
    console.log("---------------------------------------------------");
    // 👇 บรรทัดนี้แหละที่จะเฉลยว่าบอทเจออะไร
    console.log(content.substring(0, 1000)); 
    console.log("---------------------------------------------------");

    let json;
    try {
        json = JSON.parse(content);
        console.log("✅ JSON Structure Keys:", Object.keys(json));
        if (json.data) console.log("✅ Inside 'data' Keys:", Object.keys(json.data));
    } catch (e) {
        console.log("❌ Not a valid JSON (อาจจะโดนบล็อกเป็น HTML)");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await browser.close();
  }
})();