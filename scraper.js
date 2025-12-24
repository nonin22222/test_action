const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// เรียกใช้อาวุธลับ (Stealth) เพื่อหลอก Cloudflare/Anti-bot
puppeteer.use(StealthPlugin());

(async () => {
  console.log("🚀 Launching Stealth Browser (Visual Scrape)...");

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
    
    // 1. เข้าหน้าเว็บหลัก (ไม่ใช่ API)
    console.log("🌍 Navigating to Homepage...");
    await page.goto('https://www.superrich1965.com/th', { 
      waitUntil: 'networkidle2', // รอจนกว่าเน็ตจะนิ่ง
      timeout: 90000 // ให้เวลาโหลดนานหน่อย (เผื่อเน็ต GitHub ช้า)
    });

    // 2. รอให้ตารางเรทเงินปรากฏ (ตัววัดใจ)
    console.log("⏳ Waiting for rate table...");
    try {
        await page.waitForSelector('.currency-wrapper', { timeout: 30000 });
    } catch (e) {
        // ถ้าหาไม่เจอ ลองแคปหน้าจอมาดู (แต่เราจะไม่ยอมแพ้)
        console.log("⚠️ Table not found immediately. Taking screenshot...");
        throw new Error("หาตารางไม่เจอ (อาจจะโดนบล็อก หรือหน้าเว็บเปลี่ยน)");
    }

    // 3. ดูดข้อมูลจากหน้าจอ (DOM Scraping)
    console.log("👀 Extracting data from screen...");
    
    const rates = await page.evaluate(() => {
      const data = [];
      const rows = document.querySelectorAll('.currency-wrapper');

      rows.forEach(row => {
        try {
          // หาชื่อสกุลเงิน (ภาษาอังกฤษ)
          const currencyEl = row.querySelector('.english-text');
          if (!currencyEl) return;
          const currency = currencyEl.innerText.trim();

          // หาเรทราคา (ช่องที่มีตัวเลข)
          // ปกติมันจะมี text-main หลายอัน (Buying, Selling)
          // เราต้องหาอันที่อยู่ขวาสุด หรือที่มีตัวเลข
          const rateBoxes = row.querySelectorAll('.text-main');
          
          // Logic การแกะ: ปกติเว็บนี้ ช่องซ้าย=ซื้อ, ช่องขวา=ขาย
          // แต่เราต้องกรองเอาเฉพาะที่มีตัวเลข
          let buy = "0";
          let sell = "0";

          // พยายามหาตัวเลขจากกล่อง
          const numbers = [];
          rateBoxes.forEach(box => {
             const txt = box.innerText.trim();
             if (txt && !isNaN(parseFloat(txt))) {
                 numbers.push(txt);
             }
          });

          // ถ้าเจอตัวเลขอย่างน้อย 2 ตัว (ซื้อ/ขาย)
          if (numbers.length >= 2) {
              buy = numbers[numbers.length - 2]; // ตัวรองสุดท้าย
              sell = numbers[numbers.length - 1]; // ตัวสุดท้าย
          }

          if (currency) {
            data.push({ currency, buy, sell });
          }
        } catch (err) { }
      });
      return data;
    });

    console.log(`✅ Success! Scraped ${rates.length} currencies.`);

    // 4. บันทึกไฟล์ (สำคัญมาก! ต้องมีไฟล์นี้ Workflow ถึงจะผ่าน)
    const output = {
        updated_at: new Date().toISOString(),
        source: "Superrich 1965 (Visual Scrape)",
        data: rates
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