/**
 * PDF Service
 * ใช้ html-pdf-node เพื่อแปลง HTML เป็น PDF แล้วอัปโหลดขึ้น Supabase Storage
 */
const puppeteer = require('puppeteer');
const { supabase } = require('./transactionService');

/**
 * แปลง HTML เป็น PDF Buffer
 * @param {string} htmlString - โค้ด HTML
 * @returns {Promise<Buffer>} - ไฟล์ PDF ในรูปแบบ Buffer
 */
async function generatePdfBuffer(htmlString) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    // รอให้โหลด Font ภาษาไทยจาก Google Fonts สำเร็จก่อน (networkidle0)
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });
    return buffer;
  } finally {
    await browser.close();
  }
}

/**
 * อัปโหลดไฟล์ PDF ขึ้น Supabase Storage bucket 'pdf-exports'
 * @param {Buffer} buffer - ข้อมูลไฟล์ PDF
 * @param {string} filename - ชื่อไฟล์
 * @returns {Promise<string>} - Public URL สำหรับดาวน์โหลด
 */
async function uploadPdfToSupabase(buffer, filename) {
  const { data, error } = await supabase.storage
    .from('pdf-exports')
    .upload(filename, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error('❌ Supabase Upload Error:', error.message);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('pdf-exports')
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

module.exports = {
  generatePdfBuffer,
  uploadPdfToSupabase,
};
