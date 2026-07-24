/**
 * Supabase Client (Singleton)
 * สร้าง Supabase client ครั้งเดียวแล้วใช้ร่วมกันทุก service
 * เพื่อหลีกเลี่ยงการสร้าง connection ซ้ำซ้อน
 */
const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

module.exports = { supabase };
