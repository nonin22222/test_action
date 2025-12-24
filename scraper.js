const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
  console.log("🚀 Starting Scraper (Robust Text Mode)...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // ตั้งค่า User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log("🌍 Opening website...");
    await page.goto('https://www.superrich1965.com/th/exchange-rate', { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });

    // แสดงละครตบตา Cloudflare
    console.log("🎭 Acting human...");
    await new Promise(r => setTimeout(r, 5000));
    await page.mouse.move(100, 200);
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise(r => setTimeout(r, 3000));

    console.log("⏳ Waiting for rate table...");
    // รอจนกว่าจะเจอ class นี้ (ถ้าไม่เจอใน 60 วิ จะ error)
    await page.waitForSelector('.currency-wrapper', { timeout: 60000 });

    // --- เริ่มดูดข้อมูล ---
    console.log("👀 Extracting data using Text Analysis...");
    
    const extractionResult = await page.evaluate(() => {
      const data = [];
      const seenCurrencies = new Set();
      const debugLogs = [];

      // จับทุกแถวที่มี class currency-wrapper
      const rows = document.querySelectorAll('.currency-wrapper');

      // (DEBUG) แอบดูข้อความแถวแรกหน่อย ว่าบอทเห็นเป็นยังไง
      if(rows.length > 0) {
          debugLogs.push("First Row Text Visible To Bot: " + rows[0].innerText.replace(/[\n\r]+/g, ' | '));
      }

      rows.forEach(row => {
        try {
          // ดึงข้อความทั้งก้อนในบรรทัดนั้นออกมาเลย
          // เช่น: "USD United States 100-50 30.95 31.10 Calculate"
          const fullText = row.innerText; 
          
          // 1. หาชื่อสกุลเงิน (ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ 3 ตัวติดกัน)
          // เช่น USD, JPY, GBP
          const currencyMatch = fullText.match(/([A-Z]{3})/);
          if (!currencyMatch) return;
          
          const currency = currencyMatch[1];

          // กรองคำที่ไม่ใช่สกุลเงินออก (เช่นหัวตาราง SPR, THB, ISO)
          if (["SPR", "THB", "ISO", "LKR"].includes(currency)) return;

          // เช็คซ้ำ (เอาแค่เรทใบใหญ่สุดของสกุลนั้น)
          if (seenCurrencies.has(currency)) return;

          // 2. หาตัวเลขราคา (ทศนิยม)
          // ดึงตัวเลขทั้งหมดในบรรทัดออกมา
          // จะได้ array เช่น ['100', '50', '30.95', '31.10']
          const numbers = fullText.match(/(\d+\.\d{2,})/g);

          if (numbers && numbers.length >= 2) {
             // ปกติราคา ซื้อ-ขาย จะอยู่ท้ายๆ เสมอ
             // เราเอา 2 ตัวสุดท้ายที่เจอ เพราะมันคือราคา ซื้อ กับ ขาย แน่นอน
             const buy = numbers[numbers.length - 2];
             const sell = numbers[numbers.length - 1];

             // เช็คว่าราคา make sense (มากกว่า 0)
             if (parseFloat(buy) > 0) {
                data.push({ currency, buy, sell });
                seenCurrencies.add(currency);
             }
          }

        } catch (err) { }
      });

      return { data, debugLogs };
    });

    // ปริ้น Log ที่ได้จากใน Browser ออกมาดู (สำคัญมาก! จะได้รู้ว่าบอทเห็นอะไร)
    if (extractionResult.debugLogs.length > 0) {
        console.log("------------------------------------------------");
        console.log("🔍 [DEBUG] Bot saw this on the first row:");
        console.log(extractionResult.debugLogs[0]);
        console.log("------------------------------------------------");
    }

    const rates = extractionResult.data;
    console.log(`✅ Success! Scraped ${rates.length} currencies.`);

    // ถ้าได้ 0 ให้ Error ทันที พร้อมแคปหน้าจอ
    if (rates.length === 0) {
        console.log("⚠️ Found 0 items. Maybe selector mismatch? Taking screenshot...");
        await page.screenshot({ path: 'debug_empty.png', fullPage: true });
    }

    // บันทึกไฟล์
    const output = {
        updated_at: new Date().toISOString(),
        source: "Superrich 1965 (Regex Mode)",
        data: rates
    };

    fs.writeFileSync('rates.json', JSON.stringify(output, null, 2));
    console.log("💾 Saved to rates.json");

  } catch (error) {
    console.error("❌ Error:", error.message);
    // แคปหน้าจอตอน Error ไว้ดูต่างหน้า
    try {
      await page.screenshot({ path: 'debug_crash.png', fullPage: true });
    } catch(e){}
    
    process.exit(1);
  } finally {
    await browser.close();
  }
})();