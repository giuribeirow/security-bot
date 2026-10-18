const URL_REGEX = /\bhttps?:\/\/[^\s<>()]+|\b(?:discord\.gg|discord\.com\/invite)\/[a-z0-9-]+/gi;
const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'is.gd',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
  'goo.gl'
]);
const DANGEROUS_TLDS = ['.zip', '.mov', '.country', '.kim', '.gq', '.tk', '.ml', '.cf'];
const BRAND_ABUSE = [
  'discord',
  'steam',
  'nitro',
  'roblox',
  'paypal',
  'instagram',
  'facebook',
  'whatsapp',
  'google'
];

function extractLinks(content) {
  return String(content || '').match(URL_REGEX) || [];
}

function normalizeHost(rawLink) {
  const withProtocol = rawLink.startsWith('http') ? rawLink : `https://${rawLink}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function scanLinks(content, config) {
  const links = extractLinks(content);
  const findings = [];
  const allowed = new Set((config.linkPolicy?.allowedDomains || []).map((domain) =>
    String(domain).toLowerCase().replace(/^www\./, '')
  ));

  for (const link of links) {
    const host = normalizeHost(link);
    if (!host) continue;
    if ([...allowed].some((domain) => host === domain || host.endsWith(`.${domain}`))) continue;

    if (/discord\.gg|discord\.com\/invite/i.test(link) && config.linkPolicy?.blockInvites) {
      findings.push({ risk: 72, category: 'invite', reason: 'Convite de Discord não autorizado', link });
      continue;
    }
    if (config.linkPolicy?.blockShorteners && SHORTENERS.has(host)) {
      findings.push({ risk: 76, category: 'shortener', reason: 'Encurtador de link usado para ocultar destino', link });
      continue;
    }
    if (DANGEROUS_TLDS.some((tld) => host.endsWith(tld))) {
      findings.push({ risk: 70, category: 'dangerous_tld', reason: 'Domínio com TLD frequentemente usado em golpe', link });
    }
    if (
      BRAND_ABUSE.some((brand) => host.includes(brand)) &&
      !['discord.com', 'discord.gg', 'steamcommunity.com', 'paypal.com', 'google.com'].includes(host) &&
      /free|gift|nitro|claim|login|verify|support|auth|bonus|steam|discord/i.test(link)
    ) {
      findings.push({ risk: 86, category: 'phishing', reason: 'Link com aparência de phishing ou roubo de conta', link });
    }
    if (config.linkPolicy?.blockDownloads && /\.(exe|scr|bat|cmd|msi|jar|apk|ps1)(?:\?|$)/i.test(link)) {
      findings.push({ risk: 90, category: 'malware', reason: 'Arquivo executável ou download perigoso', link });
    }
  }

  return {
    links,
    findings
  };
}

module.exports = {
  extractLinks,
  scanLinks
};
