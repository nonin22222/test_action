const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function scrapeSuperrich() {
  console.log("🚀 [Ghost Mode] เริ่มต้นเจาะ Superrich สีส้ม...");

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
      '--window-size=1920,1080',
      // 👇 1. โค้ดสำคัญ: ปิดฟีเจอร์ที่บอกว่า "ฉันคือบอท"
      '--disable-blink-features=AutomationControlled' 
    ],
    // 👇 2. ไม่ให้ Chrome ใส่ default args ที่ระบุตัวตน
    ignoreDefaultArgs: ['--enable-automation'], 
  });

  try {
    const page = await browser.newPage();

    // 👇 3. ลบร่องรอยใน Javascript (สำคัญที่สุด!)
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    await page.setViewport({ width: 1920, height: 1080 });
    
    // ใช้ User-Agent ของคนจริงๆ (Windows 10 Chrome)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log("🌍 กำลังเข้าเว็บ...");
    
    // ใช้ waitUntil: 'domcontentloaded' จะเร็วกว่า networkidle
    await page.goto('https://www.superrich1965.com/th/exchange-rate', { 
      waitUntil: 'domcontentloaded', 
      timeout: 120000 
    });

    // --- ช่วงเวลาตบตา (Human Interaction) ---
    console.log("🎭 กำลังขยับเมาส์และเลื่อนจอ...");
    await new Promise(r => setTimeout(r, 5000)); // รอโหลดเบื้องต้น
    
    try {
        await page.mouse.move(100, 100);
        await page.mouse.move(200, 300);
        await page.evaluate(() => window.scrollBy(0, 700));
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate(() => window.scrollBy(0, -300));
    } catch(e) {}

    // รอให้ตารางโผล่มา (เช็ค class .currency-wrapper)
    console.log("⏳ รอโหลดตารางราคา...");
    try {
        await page.waitForSelector('.currency-wrapper', { timeout: 60000 });
    } catch (e) {
        console.log("⚠️ หาตารางไม่เจอในเวลาที่กำหนด (จะพยายามแกะต่อ)");
    }

    // --- เริ่มดึงข้อมูล ---
    console.log("👀 กำลังอ่านข้อมูล...");
    
    const rates = await page.evaluate(() => {
      const data = [];
      const seenCurrencies = new Set(); // กันซ้ำ

      // หาแถวทั้งหมด
      const rows = document.querySelectorAll('.currency-wrapper');

      rows.forEach(row => {
        try {
          // ใช้ innerText ดึงข้อความทั้งบรรทัด (วิธีนี้ทนทานที่สุด)
          // ตัวอย่างข้อความ: "USD United States 100-50 34.50 34.60"
          const text = row.innerText;
          
          // 1. หาชื่อสกุลเงิน (ตัวใหญ่ 3 ตัวติดกัน)
          const currencyMatch = text.match(/([A-Z]{3})/);
          if (!currencyMatch) return;
          const currency = currencyMatch[1];

          // กรองหัวตารางออก
          if (["SPR", "THB", "ISO", "LKR"].includes(currency)) return;
          
          // ถ้าเคยเก็บแล้ว (ใบใหญ่สุด) ให้ข้าม
          if (seenCurrencies.has(currency)) return;

          // 2. หาตัวเลข (ทศนิยม)
          // ดึงตัวเลขทั้งหมดในบรรทัดมาเป็น Array
          const numbers = text.match(/(\d+\.\d{2,})/g);

          if (numbers && numbers.length >= 2) {
             // สูตร: ตัวเลข 2 ตัวท้ายสุด คือ [ราคาซื้อ] และ [ราคาขาย] เสมอ
             const buy = numbers[numbers.length - 2];
             const sell = numbers[numbers.length - 1];

             if (parseFloat(buy) > 0) {
                data.push({ currency, buy, sell });
                seenCurrencies.add(currency);
             }
          }
        } catch (err) { }
      });
      return data;
    });

    console.log(`📊 เจอข้อมูลทั้งหมด: ${rates.length} สกุลเงิน`);

    if (rates.length === 0) {
        // ถ้าไม่เจอ ให้ Error แล้วแคปจอมาดู
        await page.screenshot({ path: 'debug_error.png', fullPage: true });
        throw new Error("ไม่พบข้อมูลเลย (โดนบล็อก หรือหน้าเว็บขาว)");
    }

    // บันทึกไฟล์
    const output = {
        updated_at: new Date().toISOString(),
        source: "Superrich 1965 (Orange)",
        data: rates
    };

    fs.writeFileSync('rates.json', JSON.stringify(output, null, 2));
    console.log("💾 บันทึกไฟล์ rates.json สำเร็จ!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

scrapeSuperrich();