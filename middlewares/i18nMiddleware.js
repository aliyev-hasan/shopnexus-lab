const fs = require('fs');
const path = require('path');

// Dəstəklənən dillər (Phase 16 spesifikasiyasına görə minimum 6 dil)
const SUPPORTED_LANGS = ['az', 'en', 'ru', 'tr', 'es', 'de'];
const DEFAULT_LANG = 'az'; // §16.3 - fallback dili həmişə Azərbaycan dilidir

const LANG_META = {
  az: { flag: '🇦🇿' },
  en: { flag: '🇬🇧' },
  ru: { flag: '🇷🇺' },
  tr: { flag: '🇹🇷' },
  es: { flag: '🇪🇸' },
  de: { flag: '🇩🇪' }
};

// BCP-47 locale kodları - Date.toLocaleDateString/toLocaleString üçün (§16.3 tarix formatı da dilə uyğun olmalıdır)
const DATE_LOCALE = {
  az: 'az-AZ', en: 'en-US', ru: 'ru-RU', tr: 'tr-TR', es: 'es-ES', de: 'de-DE'
};

// Bütün lüğətləri yaddaşa yüklə (proses başlarkən bir dəfə)
const dictionaries = {};
for (const lang of SUPPORTED_LANGS) {
  const filePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
  try {
    dictionaries[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[i18n] Failed to load locale "${lang}":`, err.message);
    dictionaries[lang] = {};
  }
}

// Nöqtəli açar yolu ilə (məs. "nav.products") iç-içə obyektdən dəyər tap
function resolveKey(dict, keyPath) {
  return keyPath.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return acc[part];
    return undefined;
  }, dict);
}

// Sətirdəki {placeholder} yerdəyişənlərini əvəz et
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  ));
}

// Açarın son seqmentini insan-oxunaqlı formaya çevir (heç vaxt xam açar göstərilmir - §16.3)
function humanizeKey(keyPath) {
  const last = keyPath.split('.').pop() || keyPath;
  return last.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function createTranslator(lang) {
  return function t(keyPath, vars) {
    let value = resolveKey(dictionaries[lang], keyPath);
    if (value === undefined && lang !== DEFAULT_LANG) {
      // §16.3 - tərcümə yoxdursa Azərbaycan dilinə keç
      value = resolveKey(dictionaries[DEFAULT_LANG], keyPath);
    }
    if (value === undefined) {
      // Son çarə - xam açarı DEYİL, insan-oxunaqlı təxmini mətni göstər
      return humanizeKey(keyPath);
    }
    if (typeof value !== 'string') return value;
    return interpolate(value, vars);
  };
}

function i18nMiddleware(req, res, next) {
  let lang = (req.cookies && req.cookies.lang) || (req.session && req.session.lang) || DEFAULT_LANG;
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;

  req.lang = lang;
  res.locals.currentLang = lang;
  res.locals.dateLocale = DATE_LOCALE[lang] || DATE_LOCALE[DEFAULT_LANG];
  res.locals.t = createTranslator(lang);
  res.locals.supportedLanguages = SUPPORTED_LANGS.map(code => ({
    code,
    flag: LANG_META[code].flag,
    name: resolveKey(dictionaries[code], 'lang.name') || code
  }));

  next();
}

module.exports = { i18nMiddleware, SUPPORTED_LANGS, DEFAULT_LANG };
