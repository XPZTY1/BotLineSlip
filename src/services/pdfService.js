/**
 * PDF Service
 * ใช้ html-pdf-node เพื่อแปลง HTML เป็น PDF แล้วอัปโหลดขึ้น Supabase Storage
 */
const htmlPdf = require('html-pdf-node');
const { supabase } = require('./transactionService');

/**
 * แปลง HTML เป็น PDF Buffer
 * @param {string} htmlString - โค้ด HTML
 * @returns {Promise<Buffer>} - ไฟล์ PDF ในรูปแบบ Buffer
 */
async function generatePdfBuffer(htmlString) {
  const options = { format: 'A4', printBackground: true };
  const file = { content: htmlString };
  return await htmlPdf.generatePdf(file, options);
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
