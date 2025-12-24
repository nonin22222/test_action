const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
  console.log("🚀 Starting Scraper (Fixed Selector Mode)...");

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
    
    // ตั้งค่า User Agent ให้เหมือนคนที่สุด
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log("🌍 Opening website...");
    await page.goto('https://www.superrich1965.com/th/exchange-rate', { 
      waitUntil: 'networkidle2', // รอจนกว่าเน็ตจะนิ่ง
      timeout: 90000 
    });

    // เพิ่มช่วงเวลาแสดงละครตบตา Cloudflare
    console.log("🎭 Performing human interactions...");
    await new Promise(r => setTimeout(r, 5000));
    await page.mouse.move(100, 200);
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 3000));

    console.log("⏳ Waiting for rate table...");
    await page.waitForSelector('.currency-wrapper', { timeout: 60000 });

    // --- เริ่มดูดข้อมูล (Logic ใหม่ตาม HTML ที่ส่งมา) ---
    console.log("👀 Extracting data...");
    
    const rates = await page.evaluate(() => {
      const data = [];
      const seenCurrencies = new Set(); // ตัวกันซ้ำ (เอาแค่เรทบนสุดของแต่ละสกุล)

      // หาแถวข้อมูลทั้งหมด
      const rows = document.querySelectorAll('.currency-wrapper');

      rows.forEach(row => {
        try {
          // 1. หาชื่อสกุลเงิน (เอาตัวที่มี font-24 จะได้ไม่ไปหยิบชื่อเต็มประเทศ)
          const currencyEl = row.querySelector('.english-text.font-24');
          if (!currencyEl) return;
          
          let currency = currencyEl.innerText.trim();
          
          // ถ้าสกุลนี้เคยเก็บไปแล้ว (เช่น USD ใบ 100) ให้ข้ามใบ 50, 20 ไปเลย
          if (seenCurrencies.has(currency)) return;

          // 2. หาตัวเลขราคา (ใน 1 แถวจะมี .text-mobile อยู่ 3 ก้อน)
          // ก้อน [0] = ธนบัตร
          // ก้อน [1] = ราคาซื้อ (Buy)
          // ก้อน [2] = ราคาขาย (Sell)
          const columns = row.querySelectorAll('.text-mobile');

          if (columns.length >= 3) {
              const buy = columns[1].innerText.trim();  // ตัวกลาง
              const sell = columns[2].innerText.trim(); // ตัวขวา

              // เช็คว่าเป็นตัวเลขจริงๆ (ไม่ใช่ขีด - หรือว่าง)
              if (buy && sell && !isNaN(parseFloat(buy))) {
                  data.push({ 
                      currency: currency, 
                      buy: buy, 
                      sell: sell 
                  });
                  
                  // จดจำว่าสกุลนี้เก็บแล้ว
                  seenCurrencies.add(currency);
              }
          }

        } catch (err) { }
      });

      return data;
    });

    console.log(`✅ Success! Scraped ${rates.length} currencies.`);

    // บันทึกไฟล์
    const output = {
        updated_at: new Date().toISOString(),
        source: "Superrich 1965 (HTML Scrape)",
        data: rates
    };

    fs.writeFileSync('rates.json', JSON.stringify(output, null, 2));
    console.log("💾 Saved to rates.json");

  } catch (error) {
    console.error("❌ Error:", error.message);
    // แคปหน้าจอถ้าพัง
    await page.screenshot({ path: 'debug_error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();