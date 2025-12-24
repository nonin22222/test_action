const puppeteer = require("puppeteer");
const fs = require("fs");

// ฟังก์ชันหลักที่เพิ่มระบบลองใหม่ (Retry)
async function startScrapingWithRetry() {
    const MAX_RETRIES = 3; // ให้โอกาสลองใหม่ได้ 3 ครั้ง

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n🏁 ความพยายามครั้งที่ ${attempt} / ${MAX_RETRIES}`);
        try {
            const result = await scrapeSuperrich();
            if (result && result.data.length > 0) {
                console.log("🎉 สำเร็จ! จบการทำงาน");
                return; // จบงานถ้าทำสำเร็จ
            } else {
                throw new Error("ดึงได้ 0 รายการ (หน้าเว็บอาจโหลดไม่เสร็จ)");
            }
        } catch (error) {
            console.error(`❌ ล้มเหลวรอบที่ ${attempt}: ${error.message}`);
            if (attempt === MAX_RETRIES) {
                console.error("😭 ยอมแพ้.. ลองครบทุกรอบแล้วยังไม่ได้");
                process.exit(1); // แจ้ง GitHub ว่าพัง
            } else {
                console.log("🔄 กำลังพัก 5 วินาที ก่อนลองใหม่...");
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
}

async function scrapeSuperrich() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--window-size=1920,1080"
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // User-Agent (ตัวเดิมที่เวิร์ค)
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log("🌐 กำลังเข้าสู่เว็บไซต์...");
    // เพิ่ม timeout เป็น 90 วิ
    await page.goto("https://www.superrich1965.com/th/exchange-rate", {
      waitUntil: "networkidle2",
      timeout: 90000,
    });

    // --- เทคนิคแก้ Cloudflare ---
    // 1. ขยับเมาส์
    try {
       await page.mouse.move(100, 100);
       await page.mouse.move(200, 300);
    } catch(e) {}

    // 2. Scroll จอลงมาหน่อย (กระตุ้นให้เนื้อหาโหลด)
    await page.evaluate(() => window.scrollBy(0, 500));

    console.log("⏳ รอโหลดตาราง... (เพิ่มเวลารอเป็น 10s)");
    // รอแบบระบุตัวตน (รอจนกว่าจะเจอคลาสนี้)
    try {
        await page.waitForSelector('.currency-wrapper', { timeout: 15000 });
    } catch (e) {
        console.log("⚠️ หา .currency-wrapper ไม่เจอในเวลาที่กำหนด");
    }
    
    // รอแถมให้อีก 3 วิ เพื่อความชัวร์
    await new Promise(resolve => setTimeout(resolve, 3000));

    // --- เริ่มดึงข้อมูล ---
    const exchangeRates = await page.evaluate(() => {
      const data = [];
      const currencyWrappers = document.querySelectorAll(".currency-wrapper");

      currencyWrappers.forEach(wrapper => {
        try {
          if (wrapper.classList.contains("currency-wrapper-header")) return;

          const currencyCode = wrapper.querySelector(".english-text")?.textContent.trim();
          
          // ดึงราคาซื้อ
          const buyRateElement = wrapper.querySelector(".text-main.text-mobile > div");
          const buyRate = buyRateElement ? parseFloat(buyRateElement.textContent.trim()) : 0;

          // ดึงราคาขาย
          const sellRateElement = wrapper.querySelector('.text-mobile[style*="color: rgb(133, 42, 0)"] > div');
          const sellRate = sellRateElement ? parseFloat(sellRateElement.textContent.trim()) : 0;

          if (currencyCode && buyRate > 0) {
            data.push({
              currency: currencyCode,
              buy: buyRate,
              sell: sellRate
            });
          }
        } catch (error) { }
      });

      return data;
    });

    console.log(`📊 พบข้อมูล ${exchangeRates.length} สกุลเงิน`);

    if (exchangeRates.length === 0) {
        // ลองแคปหน้าจอตอนที่มันหาไม่เจอมาดู
        await page.screenshot({ path: 'debug_failed.png', fullPage: true });
        console.log("📸 บันทึกภาพ debug_failed.png แล้ว");
        return null; // ส่งค่า null กลับไปเพื่อให้ loop รู้ว่าต้อง retry
    }

    // --- บันทึกไฟล์ ---
    const jsonData = {
      updated_at: new Date().toISOString(),
      source: "Superrich 1965",
      data: exchangeRates,
    };

    fs.writeFileSync('rates.json', JSON.stringify(jsonData, null, 2), "utf8");
    console.log(`✅ บันทึกข้อมูลลง rates.json สำเร็จ`);

    return jsonData;

  } catch (error) {
    throw error; // ส่ง Error ไปให้ฟังก์ชันหลักจัดการ Retry
  } finally {
    await browser.close();
  }
}

// เริ่มทำงาน
startScrapingWithRetry();