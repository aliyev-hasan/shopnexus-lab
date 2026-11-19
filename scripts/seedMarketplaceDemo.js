const bcrypt = require('bcryptjs');
const { usersDb, vendorsDb, productsDb, reviewsDb } = require('../config/db');

const dbCall = (db, method, ...args) => new Promise((resolve, reject) => db[method](...args, (err, value) => err ? reject(err) : resolve(value)));

const galleries = {
  electronics: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1000&q=85'
  ],
  pc: [
    'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?auto=format&fit=crop&w=1000&q=85'
  ],
  fashion: [
    'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85'
  ],
  sport: [
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=1000&q=85'
  ],
  home: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1000&q=85'
  ],
  beauty: [
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1000&q=85'
  ]
};

const stores = [
  { id: 'apple-baku', name: 'Apple Store Baku', email: 'apple@shopnexus.cyou', slug: 'apple-store-baku', featured: true, kind: 'electronics', description: 'Apple ekosisteminin aktual cihazları, peşəkar seçim dəstəyi və zəmanətli çatdırılma.', products: [
    ['iPhone 17e 256GB', 1199, 'A19 çipli, 48MP Fusion kameralı və MagSafe dəstəkli 6.1 düym model.'], ['MacBook Neo 13-inch', 1299, 'Səssiz fanless dizaynlı, gündəlik iş və yaradıcılıq üçün yeni nəsil Mac.'], ['MacBook Air 13-inch M5', 2499, 'M5 performansı, 512GB başlanğıc yaddaş və yüngül alüminium korpus.'], ['MacBook Pro 14-inch M5 Pro', 4299, 'M5 Pro çipi, peşəkar yaradıcı və mühəndislik iş axınları üçün.'], ['iPad Air 11-inch M4', 1499, 'M4 çipi, Apple Pencil Pro və Magic Keyboard dəstəyi.'], ['Studio Display XDR', 5799, '27 düym 5K Retina XDR, mini-LED və Thunderbolt 5 bağlantısı.']
  ]},
  { id: 'samsung-az', name: 'Samsung Store', email: 'samsung@shopnexus.cyou', slug: 'samsung-store', featured: true, kind: 'electronics', description: 'Galaxy mobil cihazları, televizor və ağıllı ev texnologiyaları üçün geniş rəsmi-stil kataloq.', products: [
    ['Samsung Galaxy S25 256GB', 1699, 'Galaxy AI imkanları və flaqman kamera sistemi.'], ['Samsung Galaxy S25 Ultra 512GB', 2899, 'S Pen, premium kamera və yüksək performanslı Ultra model.'], ['Samsung Galaxy S25 Edge 256GB', 2199, 'Nazik titan dizaynlı Galaxy S seriyası.'], ['Samsung Galaxy Z Fold7 512GB', 3999, 'Böyük qatlanan ekran və çoxpəncərəli məhsuldarlıq.'], ['Samsung Galaxy Z Flip7 256GB', 2299, 'Kompakt qatlanan dizayn və çevik cover ekran.'], ['Samsung Galaxy Tab S10 Ultra', 2499, 'Böyük AMOLED ekranlı premium Android planşet.']
  ]},
  { id: 'xiaomi-az', name: 'Xiaomi Store', email: 'xiaomi@shopnexus.cyou', slug: 'xiaomi-store', featured: true, kind: 'electronics', description: 'Xiaomi telefonları, planşetləri, wearable və smart-home cihazlarının dolu kataloqu.', products: [
    ['Xiaomi 15 Ultra', 2399, 'Snapdragon 8 Elite platforması və Leica kamera sistemi.'], ['Xiaomi Pad 7', 899, '3.2K 144Hz ekran, Snapdragon 7+ Gen 3 və 8850mAh batareya.'], ['Xiaomi 14T Pro', 1599, 'Leica optikası və yüksək sürətli HyperCharge.'], ['Xiaomi Buds 5 Pro', 399, 'Premium simsiz audio və aktiv səs-küyün ləğvi.'], ['Xiaomi Watch S4', 349, 'Sağlamlıq izləmə və uzun batareya ömrü.'], ['Xiaomi Robot Vacuum X20 Max', 1399, 'Ağıllı xəritələmə və avtomatik təmizləmə stansiyası.']
  ]},
  { id: 'pc-arena', name: 'PC Arena Pro', email: 'pcarena@shopnexus.cyou', slug: 'pc-arena-pro', featured: true, kind: 'pc', description: 'Gaming, creator və workstation sistemləri üçün ən yeni PC komponentləri.', products: [
    ['NVIDIA GeForce RTX 5090 32GB', 7999, 'Blackwell arxitekturası və DLSS 4.5 dəstəkli flaqman GPU.'], ['AMD Ryzen 9 9950X3D', 1499, 'Yüksək səviyyəli gaming və yaradıcı işlər üçün 3D V-Cache prosessor.'], ['Intel Core Ultra 9 285K', 1299, 'Yeni nəsil masaüstü performans və AI imkanları.'], ['ASUS ROG Strix SCAR 18', 6499, '18 düym ekranlı yüksək performanslı gaming laptop.'], ['Samsung 990 PRO 2TB NVMe SSD', 449, 'PCIe 4.0 yüksək sürətli daxili SSD.'], ['Corsair Vengeance 64GB DDR5', 399, 'Yüksək sürətli dual-channel masaüstü yaddaş dəsti.']
  ]},
  { id: 'sport-hub', name: 'SportHub', email: 'sporthub@shopnexus.cyou', slug: 'sporthub', featured: true, kind: 'sport', description: 'Qaçış, fitness və professional idman üçün aktual ayaqqabı, geyim və wearable seçimi.', products: [
    ['Nike Pegasus 42', 289, 'Gündəlik yol qaçışı üçün balanslı amortizasiya.'], ['Nike Vomero Premium', 459, 'Maksimum rahatlıq üçün premium yol qaçış ayaqqabısı.'], ['Nike Vaporfly 4', 539, 'Yarış tempi və marafon performansı üçün karbon lövhəli model.'], ['adidas Ultraboost 5X', 359, 'Enerji qaytaran Boost amortizasiyalı qaçış ayaqqabısı.'], ['PUMA Deviate NITRO Elite 3', 429, 'Yüngül yarış ayaqqabısı və NITROFOAM Elite texnologiyası.'], ['Garmin Forerunner 970', 1499, 'Premium GPS qaçış və triatlon smart saatı.']
  ]},
  { id: 'moda-avenue', name: 'Moda Avenue', email: 'moda@shopnexus.cyou', slug: 'moda-avenue', featured: false, kind: 'fashion', description: 'Nike, adidas, Levi’s, Zara, H&M və Uniqlo seçimləri ilə gündəlik premium moda.', products: [
    ["Levi's 501 Original Jeans", 189, 'Klassik düz kəsim ikonik denim.'], ['Zara Wool Blend Coat', 299, 'Minimal siluetli yun qarışıqlı palto.'], ['Uniqlo AIRism Cotton T-Shirt', 49, 'Nəfəs alan, yumşaq gündəlik köynək.'], ['H&M Premium Linen Shirt', 79, 'Yüngül təbii kətan köynək.'], ['Nike Tech Fleece Hoodie', 249, 'Yüngül, isti və şəhər stilli fleece hoodie.'], ['adidas Originals Firebird Track Top', 179, 'Klassik 3-Stripes idman gödəkçəsi.']
  ]},
  { id: 'nordic-home', name: 'Nordic Home', email: 'home@shopnexus.cyou', slug: 'nordic-home', featured: false, kind: 'home', description: 'IKEA, Dyson, Philips, Bosch və LG ilə funksional ev, mebel və məişət texnikası.', products: [
    ['IKEA PS 2026 Chair-bed', 899, 'Kiçik məkanlar üçün çevrilə bilən kreslo-yataq.'], ['IKEA PS 2026 Glass-door Cabinet', 649, 'Müasir şüşə qapılı saxlama dolabı.'], ['Dyson V15 Detect', 1399, 'Lazer toz aşkarlamalı simsiz tozsoran.'], ['Philips Airfryer 7000 Series', 599, 'Ağıllı proqramlı böyük həcmli hava fritözü.'], ['Bosch Series 8 Built-in Oven', 2399, 'Avtomatik proqramlı premium ankastre soba.'], ['LG OLED evo C5 65-inch', 4499, 'OLED evo panel və ağıllı TV platforması.']
  ]},
  { id: 'beauty-lab', name: 'Beauty Lab', email: 'beauty@shopnexus.cyou', slug: 'beauty-lab', featured: false, kind: 'beauty', description: 'Premium saç baxımı, dəriyə qulluq və evdə beauty texnologiyaları.', products: [
    ['Dyson Airwrap i.d.', 1399, 'Tətbiqə qoşulan çoxfunksiyalı saç formalaşdırma sistemi.'], ['Dyson Supersonic Nural', 1099, 'Ağıllı istilik qoruması olan saç quruducusu.'], ['Philips Lumea IPL 9900 Series', 1199, 'SenseIQ ilə evdə IPL tük azaltma sistemi.'], ['Braun Silk-expert Pro 5', 899, 'Sürətli və adaptiv IPL beauty cihazı.'], ["L'Oréal Revitalift Laser Cream", 59, 'Gündəlik anti-age nəmləndirici üz kremi.'], ['La Roche-Posay Anthelios UVMune 400', 49, 'SPF50+ geniş spektrli üz günəş qoruyucusu.']
  ]}
];

async function seedMarketplace() {
  if (!process.env.DEMO_ACCOUNT_PASSWORD) throw new Error('Marketplace seed üçün DEMO_ACCOUNT_PASSWORD env dəyişəni tələb olunur.');
  const password = await bcrypt.hash(process.env.DEMO_ACCOUNT_PASSWORD, 10);
  const now = new Date().toISOString();
  for (const store of stores) {
    const userId = `vendor-brand-${store.id}`;
    const vendorId = `store-brand-${store.id}`;
    await dbCall(usersDb, 'update', { _id: userId }, { $set: { full_name: `${store.name} Team`, email: store.email, password, role: 'Vendor', isActive: true, created_at: now, updated_at: now } }, { upsert: true });
    const banner = galleries[store.kind][0];
    const logo = `https://ui-avatars.com/api/?name=${encodeURIComponent(store.name)}&background=0f766e&color=ffffff&size=256&bold=true`;
    await dbCall(vendorsDb, 'update', { _id: vendorId }, { $set: { user_id: userId, store_name: store.name, store_description: store.description, store_logo: logo, store_banner: banner, slug: store.slug, status: 'ACTIVE', featured: store.featured, updated_at: now, created_at: now } }, { upsert: true });
    for (let i = 0; i < store.products.length; i++) {
      const [name, price, description] = store.products[i];
      const category = store.kind === 'fashion' ? 'Geyim' : store.kind === 'sport' ? 'İdman' : store.kind === 'home' ? 'Ev əşyaları' : store.kind === 'beauty' ? 'Kosmetika' : 'Elektronika';
      const gallery = galleries[store.kind];
      const productId = `brand-${store.id}-${i + 1}`;
      const reviews = await dbCall(reviewsDb, 'find', { product_id: productId });
      const rating = reviews.length ? Number((reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length).toFixed(2)) : 0;
      await dbCall(productsDb, 'update', { _id: productId }, { $set: { vendor_id: userId, vendor_name: store.name, name, description, price, oldPrice: Number((price * 1.12).toFixed(2)), stock_quantity: 18 + i * 7, category, category_id: category === 'Elektronika' ? 'cat-electronics' : category === 'Geyim' ? 'cat-fashion' : category === 'İdman' ? 'cat-sports' : category === 'Ev əşyaları' ? 'cat-home' : 'cat-cosmetics', image_url: gallery[i % gallery.length], image_urls: [gallery[i % gallery.length], gallery[(i + 1) % gallery.length], gallery[(i + 2) % gallery.length]], rating, reviews_count: reviews.length, badge: i < 2 ? 'Yeni' : i === 2 ? 'Bestseller' : null, created_at: new Date(Date.now() - i * 86400000).toISOString(), updated_at: now } }, { upsert: true });
    }
  }
  console.log(`Marketplace demo data hazırdır: ${stores.length} qalıcı vendor hesabı, ${stores.reduce((sum, store) => sum + store.products.length, 0)} real-brand məhsul.`);
}

if (require.main === module) seedMarketplace().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
module.exports = { seedMarketplace, stores };
