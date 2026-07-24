/**
 * Tag Parser Helper
 * สกัด #แฮชแท็ก จากข้อความ และทำความสะอาดชื่อรายการ
 */

function extractTags(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/#[^\s#]+/g);
  if (!matches) return [];
  return matches.map((tag) => tag.trim());
}

function cleanTextRemoveTags(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/#[^\s#]+/g, '').trim();
}

module.exports = {
  extractTags,
  cleanTextRemoveTags,
};
