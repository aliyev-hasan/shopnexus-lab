const bcrypt = require('bcryptjs');
const { usersDb, vendorsDb, productsDb, reviewsDb, cartDb, ordersDb, orderItemsDb, couponsDb, wishlistDb, categoriesDb, settingsDb, paymentsDb, paymentEventsDb, walletsDb, walletTransactionsDb, giftCardsDb, giftCardTransactionsDb, refundsDb, savedCardsDb, addressesDb } = require('./config/db');

const run = (db, method, ...args) => new Promise((resolve, reject) => db[method](...args, (err, result) => err ? reject(err) : resolve(result)));

const products = [
  ['Elektronika','Aurora X1 Smartphone','Flagship kamera, 5G, AMOLED ekran',1299,1599,34,'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'],
  ['Elektronika','NovaBook Pro 14','Yüngül alüminium korpuslu produktiv laptop',2199,2499,12,'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80'],
  ['Elektronika','SonicPods Max','Aktiv səs izolyasiyalı premium qulaqlıq',329,429,58,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'],
  ['Elektronika','PulseWatch 5','Sağlamlıq sensorları və GPS smart saat',449,549,41,'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'],
  ['Elektronika','ViewTab Air','10.9 düym tablet, stylus dəstəyi',799,999,24,'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Urban Bomber Jacket','Suya davamlı, premium şəhər stili',149,199,63,'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Minimal Cotton Hoodie','Rahat oversize hoodie',79,119,120,'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Classic Denim Jeans','Slim fit premium denim',89,129,77,'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Runner Flex Sneakers','Yüngül idman ayaqqabısı',139,179,52,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Linen Summer Shirt','Nəfəs alan kətan köynək',59,89,95,'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Metro Leather Backpack','Laptop bölməli dəri çanta',189,249,28,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Chrono Steel Watch','Paslanmaz polad klassik saat',259,329,36,'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Polarized Sun Glasses','UV400 qoruma, premium çərçivə',99,139,67,'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Travel Wallet Pro','RFID qoruma ilə səyahət pulqabı',49,69,84,'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Silk Pattern Scarf','Yumşaq ipək şərf',69,99,45,'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Nordic Coffee Table','Minimalist taxta jurnal masası',299,399,18,'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Cloud Ceramic Dinner Set','12 parça premium yemək dəsti',119,169,39,'https://images.unsplash.com/photo-1585849834908-3481231155e8?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Luma Desk Lamp','Tənzimlənən LED masa lampası',89,129,64,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Aroma Diffuser Plus','Səssiz ultrasonic aroma yayıcı',59,79,101,'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Cozy Knit Throw','Dekorativ toxunma plaid',74,99,56,'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80'],
  ['Kosmetika','Hydra Glow Face Cream','Nəmləndirici üz kremi, 50ml',49,69,0,'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80'],
  ['Kosmetika','Velvet Rose Perfume','Gül ətri, uzun müddət qalıcı',129,169,4,'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80'],
  ['Kosmetika','Silk Lip Balm','Qidalandırıcı dodaq balzamı',19,29,3,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=80'],
  ['Kosmetika','Pure Botanic Shampoo','Təbii tərkibli şampun, 300ml',39,49,45,'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80'],
  ['Kosmetika','Glow Clay Face Mask','Təmizləyici gil maskası',29,39,22,'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80'],
  ['Kosmetika','SunShield SPF50','Günəş kremi, UV qoruma',59,79,38,'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=80'],
  ['İdman','Pro Dumbbell Set','Tənzimlənən dumbbell dəsti, 20kg',199,249,15,'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?auto=format&fit=crop&w=900&q=80'],
  ['İdman','Flex Yoga Mat','Sürüşməyən yoga matı',49,69,5,'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&w=900&q=80'],
  ['İdman','Cardio Run Belt','Qaçış kəməri, su keçirməz',29,39,0,'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=80'],
  ['İdman','Urban Mountain Bike','Yüngül çərçivəli dağ velosipedi',899,1199,8,'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80'],
  ['İdman','Power Soccer Ball','Professional futbol topu',59,89,30,'https://images.unsplash.com/photo-1614632537190-23e4146777db?auto=format&fit=crop&w=900&q=80'],
  ['İdman','Hydra Sport Bottle','İzolyasiyalı idman su şüşəsi, 750ml',39,49,55,'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80'],
  ['Kitablar','The Silent Horizon','Bestseller roman',29,39,42,'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80'],
  ['Kitablar','Business Mastery','Biznes strategiyaları kitabı',39,49,18,'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=900&q=80'],
  ['Kitablar','Children Storybook','Rəngli uşaq nağıl kitabı',19,25,2,'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'],
  ['Kitablar','Math Textbook','Riyaziyyat dərsliyi, lisey',49,59,25,'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=80'],
  ['Kitablar','Gourmet Cooking','Kulinariya kitabı, 100 resept',45,59,12,'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80'],
  ['Kitablar','Science Explained','Elmi-populyar kitab',35,45,7,'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Velvet Throw Pillow','Dekorativ yastıq, məxmər',49,69,2,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Ceramic Plant Pot','Minimalist keramik dibçək',39,49,0,'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Linen Bedding Set','Kətan yataq dəsti, kral',199,259,16,'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=900&q=80'],
  ['Ev əşyaları','Aroma Scented Candle','Ətirli şam, vanil',29,39,40,'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Cashmere Scarf','Kaşmir şərf, yumşaq',89,129,6,'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Classic Trench Coat','Zaman keçdikcə dəbləşən trenç',299,399,11,'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Everyday Leather Belt','Əsl dəri kəmər',49,69,0,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80'],
  ['Geyim','Wool Beanie','Yun papaq, qış',29,39,33,'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=900&q=80'],
  ['Elektronika','Smart Home Speaker','Səs idarəetməli ağıllı dinamik',199,249,1,'https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=900&q=80'],
  ['Elektronika','Wireless Charger Pad','Sürətli simsiz şarj',49,69,27,'https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Leather Key Holder','Dəri açar tutacaq',25,35,14,'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=80'],
  ['Aksessuar','Minimalist Bracelet','Paslanmaz polad bilərzik',45,65,9,'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80']
];

async function main() {
  // Real və demo vendor hesabları qalıcıdır: seed users/vendors kolleksiyalarını silmir.
  await Promise.all([productsDb, reviewsDb, cartDb, ordersDb, orderItemsDb, couponsDb, wishlistDb, categoriesDb, settingsDb, paymentsDb, paymentEventsDb, walletsDb, walletTransactionsDb, giftCardsDb, giftCardTransactionsDb, refundsDb, savedCardsDb, addressesDb].map(db => run(db, 'remove', {}, { multi: true })));

  // Default komissiya
  await run(settingsDb, 'insert', { _id: 'setting-commission', key: 'commission_rate', value: 10 });

  // Cashback default
  await run(settingsDb, 'insert', { _id: 'setting-cashback', key: 'cashback_percent', value: 3 });

  // Ödəniş simulyatoru default tənzimləmələri
  await run(settingsDb, 'insert', { _id: 'setting-payment-force', key: 'payment_force_result', value: '' });
  await run(settingsDb, 'insert', { _id: 'setting-payment-delay', key: 'payment_delay_ms', value: 0 });

  // Kateqoriyalar
  const categoryMap = {
    'Elektronika': 'cat-electronics',
    'Geyim': 'cat-fashion',
    'Aksessuar': 'cat-accessories',
    'Ev əşyaları': 'cat-home',
    'Kosmetika': 'cat-cosmetics',
    'İdman': 'cat-sports',
    'Kitablar': 'cat-books'
  };
  const categoryDefinitions = [
    ['cat-electronics', 'Elektronika', 'Smartfon, laptop və elektron cihazlar'],
    ['cat-fashion', 'Geyim', 'Geyim və ayaqqabı'],
    ['cat-accessories', 'Aksessuar', 'Saat, çanta və aksesuarlar'],
    ['cat-home', 'Ev əşyaları', 'Ev və ofis üçün məhsullar'],
    ['cat-cosmetics', 'Kosmetika', 'Kosmetika və şəxsi baxım'],
    ['cat-sports', 'İdman', 'İdman avadanlıqları və geyim'],
    ['cat-books', 'Kitablar', 'Kitablar və nəşrlər']
  ];
  for (const [id, name, description] of categoryDefinitions) {
    await run(categoriesDb, 'insert', { _id: id, name, description, created_at: new Date().toISOString() });
  }

  if (!process.env.DEMO_ACCOUNT_PASSWORD) throw new Error('Seed üçün DEMO_ACCOUNT_PASSWORD env dəyişəni tələb olunur.');
  const password = await bcrypt.hash(process.env.DEMO_ACCOUNT_PASSWORD, 10);
  const admin = { _id: 'admin-demo', full_name: 'ShopNexus Admin', email: 'admin@shopnexus.cyou', password, role: 'Admin', isActive: true, created_at: new Date().toISOString() };
  const vendorUser = { _id: 'vendor-demo', full_name: 'Premium Vendor', email: 'vendor@shopnexus.cyou', password, role: 'Vendor', isActive: true, created_at: new Date().toISOString() };
  const customer = { _id: 'customer-demo', full_name: 'Demo Customer', email: 'customer@shopnexus.cyou', password, role: 'Customer', isActive: true, created_at: new Date().toISOString() };
  await run(usersDb, 'update', { _id: admin._id }, { $set: admin }, { upsert: true });
  await run(usersDb, 'update', { _id: vendorUser._id }, { $set: vendorUser }, { upsert: true });
  await run(usersDb, 'update', { _id: customer._id }, { $set: customer }, { upsert: true });
  await run(vendorsDb, 'update', { _id: 'vendor-store-demo' }, { $set: { user_id: vendorUser._id, store_name: 'Nexus Premium Store', store_description: 'Seçilmiş premium məhsullar və sürətli çatdırılma', slug: 'nexus-premium-store', status: 'ACTIVE', featured: false } }, { upsert: true });

  // Demo istifadəçilər üçün başlanğıc cüzdanlar (50 ₼)
  await run(walletsDb, 'insert', { _id: 'wallet-admin-demo', user_id: admin._id, balance: 50, updated_at: new Date().toISOString() });
  await run(walletsDb, 'insert', { _id: 'wallet-vendor-demo', user_id: vendorUser._id, balance: 50, updated_at: new Date().toISOString() });
  await run(walletsDb, 'insert', { _id: 'wallet-customer-demo', user_id: customer._id, balance: 50, updated_at: new Date().toISOString() });
  await run(couponsDb, 'insert', { _id: 'coupon-nexus10', code: 'NEXUS10', discount_type: 'percentage', discount_value: 10, usage_limit: 1000, used_count: 0, min_order_value: 100, expiry_date: new Date(Date.now() + 365 * 86400000).toISOString() });

  for (let i = 0; i < products.length; i++) {
    const [category, name, description, price, oldPrice, stock, image_url] = products[i];
    const doc = await run(productsDb, 'insert', {
      _id: `prod-${String(i + 1).padStart(2, '0')}`,
      vendor_id: vendorUser._id,
      vendor_name: 'Nexus Premium Store',
      category,
      category_id: categoryMap[category] || null,
      name, description, price, oldPrice, stock_quantity: stock,
      image_url, rating: 0, reviews_count: 0,
      badge: i % 3 === 0 ? 'Günün təklifi' : i % 3 === 1 ? 'Yeni' : 'Bestseller',
      created_at: new Date(Date.now() - i * 86400000).toISOString()
    });

    // Hər məhsula real rəylər və onlardan hesablanan rating
    const ratings = [5, 4, 5];
    let ratingSum = 0;
    for (let r = 0; r < ratings.length; r++) {
      const rating = ratings[r];
      ratingSum += rating;
      await run(reviewsDb, 'insert', { _id: `rev-${i}-${r}`, product_id: doc._id, user_id: 'customer-demo', rating, comment: ['Çox keyfiyyətli məhsuldur.', 'Çatdırılma sürətli oldu.', 'Qiymətinə görə əladır.'][r], created_at: new Date().toISOString() });
    }
    const avgRating = Number((ratingSum / ratings.length).toFixed(1));
    await run(productsDb, 'update', { _id: doc._id }, { $set: { rating: avgRating, reviews_count: ratings.length } }, {});
  }
  await require('./scripts/seedMarketplaceDemo').seedMarketplace();
  console.log('Seed tamamlandı: 3 demo hesab, 48 məhsul, rəylər əlavə edildi.');
  console.log('Demo hesablar yaradıldı; şifrə yalnız DEMO_ACCOUNT_PASSWORD env dəyişənindən götürüldü.');
}

main().catch(err => { console.error(err); process.exit(1); });
