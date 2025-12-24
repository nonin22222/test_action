const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// ใช้งาน Stealth Plugin เพื่อทะลุ Cloudflare
puppeteer.use(StealthPlugin());

(async () => {
  console.log("🚀 Starting Scraper (Single Rate Mode)...");

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
    
    // ตั้งค่าให้เหมือนคนใช้งานจริงที่สุด
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log("🌍 Opening website...");
    // เข้าหน้าเว็บหลัก (ที่มีตารางราคา)
    await page.goto('https://www.superrich1965.com/th/exchange-rate', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // รอให้ตารางโหลด (สังเกตจาก class ที่คุณส่งมา)
    console.log("⏳ Waiting for table...");
    await page.waitForSelector('.currency-wrapper', { timeout: 30000 });

    // --- เริ่มดูดข้อมูล ---
    console.log("👀 Extracting data...");
    
    const rates = await page.evaluate(() => {
      const data = [];
      const seenCurrencies = new Set(); // ตัวช่วยจำว่าเก็บสกุลเงินนี้ไปหรือยัง

      // หาแถวข้อมูลทั้งหมด
      const rows = document.querySelectorAll('.currency-wrapper');

      rows.forEach(row => {
        try {
          // 1. หาชื่อสกุลเงิน (เช่น USD, JPY)
          const currencyEl = row.querySelector('.english-text'); // แก้จากโค้ดที่คุณส่งมา
          if (!currencyEl) return;
          
          let currency = currencyEl.innerText.trim();
          
          // *** หัวใจสำคัญ: ถ้าเก็บสกุลนี้ไปแล้ว ให้ข้ามเลย (เพื่อให้ได้แค่ราคาเดียว) ***
          if (seenCurrencies.has(currency)) return;

          // 2. หาเรทราคา
          // จาก HTML ที่คุณส่งมา:
          // เรทรับซื้อ (Buying) อยู่ใน class "text-main text-mobile"
          // เรทขาย (Selling) อยู่ใน class "text-mobile" (ตัวที่มีสีส้ม/แดง)
          
          const buyEl = row.querySelector('.text-main.text-mobile');
          
          // ตัวขายจะหายากหน่อย เพราะ class มันซ้ำๆ เราเลยใช้วิธีหาตัวเลขถัดไป
          // ปกติมันจะเรียง: [Denom] [Buy] [Sell]
          // เราเลยกวาด text-mobile ทั้งหมดมาดู
          const numberBoxes = row.querySelectorAll('.text-mobile');
          
          let buy = "0";
          let sell = "0";

          // แกะตัวเลข (Logic นี้แม่นยำสำหรับโครงสร้างเว็บนี้)
          if (numberBoxes.length >= 3) {
             // Index 1 มักจะเป็น Buy (Index 0 คือ Denom 100-50)
             buy = numberBoxes[1].innerText.trim();
             // Index 2 มักจะเป็น Sell
             sell = numberBoxes[2].innerText.trim();
          } else if (buyEl) {
             // กรณีสำรอง
             buy = buyEl.innerText.trim();
          }

          // ถ้าได้ข้อมูลครบ ให้บันทึก
          if (currency && buy !== "0") {
            data.push({ 
                currency: currency, 
                buy: buy, 
                sell: sell 
            });
            seenCurrencies.add(currency); // จดไว้ว่าเก็บ USD ไปแล้ว แถวต่อไปที่เป็น USD ใบย่อยจะไม่เก็บ
          }

        } catch (err) { 
            // ข้ามแถวที่ Error
        }
      });

      return data;
    });

    console.log(`✅ Success! Extracted ${rates.length} unique currencies.`);

    // บันทึกไฟล์
    const output = {
        updated_at: new Date().toISOString(),
        source: "Superrich 1965 (Single Rate)",
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