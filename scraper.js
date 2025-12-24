const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeSuperrich() {
  console.log("🚀 [GitHub Actions Mode] เริ่มต้นการดึงข้อมูล...");

  const browser = await puppeteer.launch({
    headless: "new",
    // ❌ ตัดบรรทัด executablePath ทิ้ง (ให้มันหา Chrome ของ Server เอง)
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

    // ตั้งค่าหน้าจอ
    await page.setViewport({ width: 1920, height: 1080 });
    
    // User-Agent (ใช้ตัวเดิมที่คุณเทสผ่าน)
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log("🌐 กำลังเข้าสู่เว็บไซต์...");
    await page.goto("https://www.superrich1965.com/th/exchange-rate", {
      waitUntil: "networkidle2",
      timeout: 90000,
    });

    // เพิ่มการขยับเมาส์นิดหน่อยเผื่อ Cloudflare สงสัย
    try {
       await page.mouse.move(100, 200);
       await page.evaluate(() => window.scrollBy(0, 300));
    } catch(e) {}

    console.log("⏳ รอให้ข้อมูลโหลด (5s)...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // --- ส่วน Logic การดึงข้อมูล (คงเดิมของคุณไว้เป๊ะๆ) ---
    const exchangeRates = await page.evaluate(() => {
      const data = [];
      const currencyWrappers = document.querySelectorAll(".currency-wrapper");

      currencyWrappers.forEach(wrapper => {
        try {
          if (wrapper.classList.contains("currency-wrapper-header")) return;

          const currencyCode = wrapper.querySelector(".english-text")?.textContent.trim();
          
          // ดึงราคาซื้อ (ค่าแรก)
          const buyRateElement = wrapper.querySelector(".text-main.text-mobile > div");
          const buyRate = buyRateElement ? parseFloat(buyRateElement.textContent.trim()) : 0;

          // ดึงราคาขาย (ค่าแรก) - Selector เดิมของคุณ
          const sellRateElement = wrapper.querySelector('.text-mobile[style*="color: rgb(133, 42, 0)"] > div');
          const sellRate = sellRateElement ? parseFloat(sellRateElement.textContent.trim()) : 0;

          if (currencyCode && buyRate && sellRate) {
            data.push({
              currency: currencyCode,
              buy: buyRate,  // ผมเปลี่ยนชื่อ key ให้สั้นลงเพื่อให้ตรงกับ WordPress เก่า (buy/sell)
              sell: sellRate
            });
          }
        } catch (error) { }
      });

      return data;
    });

    console.log(`\n📊 พบข้อมูล ${exchangeRates.length} สกุลเงิน`);

    if (exchangeRates.length === 0) {
        throw new Error("ไม่พบข้อมูล (อาจโดนบล็อก หรือหน้าเว็บเปลี่ยน)");
    }

    // --- บันทึกไฟล์ (เซฟลง rates.json ตรงๆ เลย) ---
    const jsonData = {
      updated_at: new Date().toISOString(),
      source: "Superrich 1965",
      data: exchangeRates,
    };

    fs.writeFileSync('rates.json', JSON.stringify(jsonData, null, 2), "utf8");
    console.log(`✅ บันทึกข้อมูลลง rates.json สำเร็จ`);

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

scrapeSuperrich();