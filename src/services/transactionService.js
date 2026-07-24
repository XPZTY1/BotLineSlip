/**
 * Transaction Service
 * เชื่อมต่อ อ่าน และเขียนข้อมูลธุรกรรมลง Supabase (PostgreSQL)
 */
const { supabase } = require('./supabaseClient');
const { config } = require('../config');

const TABLE = config.supabase.table;

// จำกัดจำนวน rows สูงสุดที่ดึงในคราวเดียว เพื่อป้องกัน query ขนาดใหญ่
const MAX_ROWS = 500;

function toTransactionRow(data, lineUserId = null) {
  const { item, amount, category, type, date, tags } = data;
  const row = {
    item,
    amount,
    category,
    type,
    date,
    line_user_id: lineUserId,
  };
  if (tags && Array.isArray(tags) && tags.length > 0) {
    row.tags = tags;
  }
  return row;
}

async function appendTransaction(data, lineUserId = null) {
  try {
    const row = toTransactionRow(data, lineUserId);
    let { data: inserted, error } = await supabase
      .from(TABLE)
      .insert([row])
      .select();

    // Fallback: หากยังไม่ได้เพิ่มคอลัมน์ tags ใน Supabase ให้ลบ tags ออกแล้วลองบันทึกซ้ำ
    if (error && error.message && error.message.includes('tags')) {
      delete row.tags;
      const res = await supabase.from(TABLE).insert([row]).select();
      inserted = res.data;
      error = res.error;
    }

    if (error) {
      console.error('❌ Supabase Insert Error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ บันทึก: ${data.item} | ${data.amount} | ${data.category} | ${data.type} | ${data.date}`);
    return { success: true, data: inserted };
  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function getTransactions(lineUserId, dateFrom, dateTo) {
  try {
    let query = supabase
      .from(TABLE)
      .select('id, item, amount, category, type, date, tags')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    if (lineUserId) {
      query = query.eq('line_user_id', lineUserId);
    }

    let { data, error } = await query;

    // Fallback: หากยังไม่ได้เพิ่มคอลัมน์ tags ใน Supabase
    if (error && error.message && error.message.includes('tags')) {
      let fallbackQuery = supabase
        .from(TABLE)
        .select('id, item, amount, category, type, date')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true });

      if (lineUserId) {
        fallbackQuery = fallbackQuery.eq('line_user_id', lineUserId);
      }
      const res = await fallbackQuery;
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('❌ Supabase Select Error:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
    return null;
  }
}

async function getAllTransactions(lineUserId) {
  try {
    let query = supabase
      .from(TABLE)
      .select('id, item, amount, category, type, date, tags')
      .order('date', { ascending: false }) // ล่าสุดก่อน
      .limit(MAX_ROWS);

    if (lineUserId) {
      query = query.eq('line_user_id', lineUserId);
    }

    let { data, error } = await query;

    // Fallback: หากยังไม่ได้เพิ่มคอลัมน์ tags ใน Supabase
    if (error && error.message && error.message.includes('tags')) {
      let fallbackQuery = supabase
        .from(TABLE)
        .select('id, item, amount, category, type, date')
        .order('date', { ascending: false })
        .limit(MAX_ROWS);

      if (lineUserId) {
        fallbackQuery = fallbackQuery.eq('line_user_id', lineUserId);
      }
      const res = await fallbackQuery;
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('❌ Supabase Select Error:', error.message);
      return null;
    }

    // คืนค่าเรียงจากเก่าไปใหม่สำหรับ render
    return data.reverse();
  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
    return null;
  }
}

async function deleteLastTransaction(lineUserId) {
  try {
    if (!lineUserId) return { success: false, error: 'User ID is required' };

    // หาบรรทัดล่าสุดของผู้ใช้
    const { data, error: selectError } = await supabase
      .from(TABLE)
      .select('id, item, amount, category, type, date')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (selectError || !data || data.length === 0) {
      return { success: false, error: 'ไม่พบบันทึกรายการที่จะลบ' };
    }

    const lastRow = data[0];
    console.log(`🗑️ [deleteLastTransaction] กำลังลบ id=${lastRow.id}, item="${lastRow.item}", userId=${lineUserId}`);

    const { data: deletedData, error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', lastRow.id)
      .eq('line_user_id', lineUserId)
      .select();

    if (deleteError) {
      console.error('❌ Supabase Delete Error:', deleteError.message);
      return { success: false, error: deleteError.message };
    }

    // ถ้า deletedData เป็น array ว่าง = ลบไม่สำเร็จ (ถูก RLS block หรือ row ไม่มีแล้ว)
    if (!deletedData || deletedData.length === 0) {
      console.error('❌ Delete ไม่สำเร็จ — อาจถูก RLS block หรือไม่พบ row ที่ตรงเงื่อนไข');
      return { success: false, error: 'ลบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การลบใน Supabase (RLS Policy)' };
    }

    console.log(`✅ ลบสำเร็จ: id=${lastRow.id}, item="${lastRow.item}"`);
    return { success: true, deleted: lastRow };
  } catch (error) {
    console.error('❌ Delete Last Transaction Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function deleteTransactionById(id, lineUserId) {
  try {
    if (!id || !lineUserId) return { success: false, error: 'ID and User ID are required' };
    
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('line_user_id', lineUserId)
      .select();

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'ไม่สามารถลบรายการได้' };

    return { success: true, deleted: data[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateTransaction(id, lineUserId, updates) {
  try {
    if (!id || !lineUserId) return { success: false, error: 'ID and User ID are required' };

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .eq('line_user_id', lineUserId)
      .select();

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'ไม่สามารถอัปเดตรายการได้' };

    return { success: true, updated: data[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getTransactionsByTag(lineUserId, tag) {
  try {
    let query = supabase
      .from(TABLE)
      .select('id, item, amount, category, type, date, tags')
      .order('date', { ascending: true });

    if (lineUserId) {
      query = query.eq('line_user_id', lineUserId);
    }

    if (tag) {
      const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
      query = query.contains('tags', [cleanTag]);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ Supabase Tag Select Error:', error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
    return [];
  }
}

async function registerActiveUser(lineUserId) {
  if (!lineUserId) return;
  try {
    await supabase.from('users').upsert([
      { line_user_id: lineUserId, last_active: new Date().toISOString() }
    ], { onConflict: 'line_user_id' });
  } catch (err) {
    // ignore if users table not yet created
  }
}

async function getAllActiveUserIds() {
  try {
    const { data, error } = await supabase.from('users').select('line_user_id');
    if (error || !data) {
      // Fallback: ดึง unique line_user_id จากตาราง transactions
      const { data: txData } = await supabase.from(TABLE).select('line_user_id').not('line_user_id', 'is', null);
      if (!txData) return [];
      const userIds = [...new Set(txData.map(r => r.line_user_id))];
      return userIds;
    }
    return data.map(u => u.line_user_id);
  } catch (err) {
    return [];
  }
}

async function testConnection() {
  try {
    const { error } = await supabase.from(TABLE).select('id').limit(1);
    if (error) {
      console.error('❌ ไม่สามารถเชื่อมต่อ Supabase:', error.message);
      return false;
    }
    console.log('✅ เชื่อมต่อ Supabase สำเร็จ');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

module.exports = {
  appendTransaction,
  deleteLastTransaction,
  deleteTransactionById,
  getAllActiveUserIds,
  getAllTransactions,
  getTransactions,
  getTransactionsByTag,
  registerActiveUser,
  testConnection,
  updateTransaction,
};