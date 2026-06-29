const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

function fileHash(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function extractTextFromFile(filePath, mimeType = '') {
  if (!filePath || !fs.existsSync(filePath)) return { text: '', extraction_method: 'missing_file' };
  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      const parsed = await pdfParse(fs.readFileSync(filePath));
      return { text: (parsed.text || '').slice(0, 20000), extraction_method: 'pdf_text', file_size: stats.size, pages: parsed.numpages };
    } catch (err) {
      return { text: '', extraction_method: 'pdf_parse_failed', error: err.message, file_size: stats.size };
    }
  }
  const readable = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.log'].includes(ext) || /^text\//.test(mimeType) || /json/.test(mimeType);
  if (!readable) {
    return {
      text: '',
      extraction_method: 'metadata_only',
      note: 'Binary file uploaded. Configure OCR for scanned images or non-text documents.',
      file_size: stats.size,
    };
  }
  return { text: fs.readFileSync(filePath, 'utf8').slice(0, 20000), extraction_method: 'plain_text', file_size: stats.size };
}

function analyzeDocumentText(text) {
  const lower = String(text || '').toLowerCase();
  const clauses = [
    ['termination', 'Termination rights or cancellation language found'],
    ['renewal', 'Renewal or extension terms found'],
    ['payment', 'Payment terms found'],
    ['performance obligation', 'Performance obligation language found'],
    ['service level', 'Service level commitment found'],
    ['warranty', 'Warranty language found'],
    ['refund', 'Refund or credit right found'],
    ['variable consideration', 'Variable consideration language found'],
    ['acceptance', 'Customer acceptance language found'],
    ['milestone', 'Milestone billing or delivery language found'],
  ].filter(([needle]) => lower.includes(needle)).map(([, finding]) => finding);
  return {
    document_summary: text ? text.replace(/\s+/g, ' ').slice(0, 900) : 'No extractable text was available.',
    detected_clauses: clauses,
    asc_606_signals: {
      contract_identification: /contract|agreement|customer|vendor|party/i.test(text),
      performance_obligations: /deliver|service|license|support|implementation|performance obligation|milestone/i.test(text),
      transaction_price: /\$|payment|fee|price|consideration|invoice/i.test(text),
      allocation_evidence: /standalone|ssp|allocate|allocation/i.test(text),
      recognition_timing: /monthly|quarterly|over time|point in time|upon delivery|acceptance/i.test(text),
      variable_consideration: /bonus|penalty|refund|credit|usage|overage|variable/i.test(text),
    },
    recommended_actions: clauses.length
      ? ['Review detected clauses against ASC 606 workpaper checklist.', 'Attach reviewer conclusion to the contract evidence packet.']
      : ['Upload searchable contract text or configure OCR to enable clause-level analysis.'],
  };
}

async function buildDocumentIntelligence(row) {
  const extracted = await extractTextFromFile(row.file_path, row.mime_type);
  return {
    file_name: row.file_name,
    file_hash_sha256: fileHash(row.file_path),
    extracted_at: new Date().toISOString(),
    extraction_method: extracted.extraction_method,
    pages: extracted.pages || null,
    error: extracted.error || null,
    text_preview: extracted.text.slice(0, 2000),
    ...analyzeDocumentText(extracted.text),
  };
}

module.exports = {
  analyzeDocumentText,
  buildDocumentIntelligence,
  extractTextFromFile,
  fileHash,
};
