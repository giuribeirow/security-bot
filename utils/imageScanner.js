const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar imagem HTTP ${response.status}.`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function decodeImage(buffer, contentType = '') {
  if (/png/i.test(contentType)) {
    const png = PNG.sync.read(buffer);
    return { data: Uint8ClampedArray.from(png.data), width: png.width, height: png.height };
  }
  if (/jpe?g/i.test(contentType)) {
    const image = jpeg.decode(buffer, { useTArray: true });
    return { data: Uint8ClampedArray.from(image.data), width: image.width, height: image.height };
  }
  return null;
}

async function scanImageAttachment(attachment, member, config) {
  const contentType = attachment.contentType || '';
  if (!/^image\/(png|jpe?g)$/i.test(contentType)) {
    return null;
  }
  const findings = [];
  if (attachment.size > MAX_IMAGE_BYTES) {
    findings.push({ risk: 45, category: 'large_image', reason: 'Imagem muito grande para análise completa' });
  }

  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
  if (config.image?.flagNewAccountsWithImages && accountAgeDays < (config.image.newAccountDays || 7)) {
    findings.push({ risk: 42, category: 'new_account_image', reason: 'Conta recente enviando imagem' });
  }

  if (config.image?.detectQrCodes && attachment.size <= MAX_IMAGE_BYTES) {
    const buffer = await fetchBuffer(attachment.url);
    const decoded = decodeImage(buffer, contentType);
    if (decoded) {
      const qr = jsQR(decoded.data, decoded.width, decoded.height);
      if (qr?.data) {
        findings.push({
          risk: /https?:\/\//i.test(qr.data) ? 82 : 65,
          category: 'qr_code',
          reason: 'QR code detectado na imagem',
          details: qr.data.slice(0, 140)
        });
      }
    }
  }

  return findings.length
    ? {
      attachmentId: attachment.id,
      name: attachment.name,
      contentType,
      findings
    }
    : null;
}

async function scanMessageImages(message, config) {
  const results = [];
  for (const attachment of message.attachments.values()) {
    const result = await scanImageAttachment(attachment, message.member, config).catch(() => null);
    if (result) results.push(result);
  }
  return results;
}

module.exports = {
  scanMessageImages
};
