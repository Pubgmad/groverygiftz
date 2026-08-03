const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/groverygiftz';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // 1. Seed Admin
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
  await db.collection('admins').updateOne(
    { email: process.env.ADMIN_EMAIL || 'admin@groverygiftz.com' },
    { $setOnInsert: { name: 'Admin', email: process.env.ADMIN_EMAIL || 'admin@groverygiftz.com', password: adminPassword, role: 'superadmin', createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
  console.log('Admin seeded');

  // 2. Seed Settings
  const existingSettings = await db.collection('settings').findOne();
  if (!existingSettings) {
    await db.collection('settings').insertOne({
      siteName: 'GroveryGiftz',
      tagline: 'Perfect Gifts for Your Loved Ones',
      phone: '+91 99945 49781',
      email: 'Groverygiftz@gmail.com',
      whatsapp: '919994549781',
      address: '126, 3rd St, V.C.K.N.Layout, Sivananda Colony, Tatabad, Coimbatore, Tamil Nadu 641012',
      timings: '11 am to 7 pm',
      announcementText: 'Tamil Nadu delivery free | Pan India delivery available',
      socialLinks: { instagram: 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy', youtube: '' },
      freeShippingThreshold: 499,
      shippingCost: 40,
      tamilNaduShippingCost: 0,
      otherStateShippingCost: 120,
      tamilNaduDeliveryEstimate: 'Within 8 days',
      otherStateDeliveryEstimate: '10-15 days',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Settings seeded');
  }

  // 3. Seed Collections
  const collections = [
    { name: 'Birthday Gifts', slug: 'birthday-gifts', description: 'Make every birthday special with our curated gift selection', order: 1, isFeatured: true, isActive: true },
    { name: 'Love Combos', slug: 'love-combos', description: 'Express your love with beautiful gift combos', order: 2, isFeatured: true, isActive: true },
    { name: "Bottle Of Emotions", slug: 'bottle-of-emotions', description: 'Message bottles, 52 reasons jars, and keepsake emotion gifts', order: 2.5, isFeatured: true, isActive: true },
    { name: "Valentine's Day Collection", slug: 'valentines-day-collection', description: "Romantic gifts for Valentine's Day and special dates", order: 2.7, isFeatured: true, isActive: true },
    { name: 'Return Gifts', slug: 'return-gifts', description: 'Premium return gifts for every occasion', order: 3, isFeatured: true, isActive: true },
    { name: 'Personalized Gifts', slug: 'personalized-gifts', description: 'Unique personalized gifts that say it all', order: 4, isFeatured: true, isActive: true },
    { name: 'Wedding Gifts', slug: 'wedding-gifts', description: 'Celebrate the union with elegant wedding gifts', order: 5, isFeatured: false, isActive: true },
    { name: 'Anniversary Gifts', slug: 'anniversary-gifts', description: 'Celebrate milestones with perfect anniversary gifts', order: 6, isFeatured: false, isActive: true },
    { name: 'Festive Gifts', slug: 'festive-gifts', description: 'Spread festive joy with our seasonal collection', order: 7, isFeatured: false, isActive: true },
    { name: 'Corporate Gifts', slug: 'corporate-gifts', description: 'Professional gift solutions for corporate needs', order: 8, isFeatured: false, isActive: true },
  ];

  for (const col of collections) {
    await db.collection('collections').updateOne(
      { slug: col.slug },
      { $setOnInsert: { ...col, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('Collections seeded');

  // 4. Seed Sample Products
  const collectionDocs = await db.collection('collections').find({}).toArray();
  const colMap = {};
  for (const c of collectionDocs) colMap[c.slug] = c._id;

  const products = [
    {
      title: 'Personalized Moon Lamp Frame',
      slug: 'personalized-moon-lamp-frame',
      description: '<p>A beautiful moon-shaped lamp frame that can be personalized with your favorite photo. Perfect for gifting to your loved ones on any occasion.</p><ul><li>LED illumination</li><li>Multiple color modes</li><li>Rechargeable battery</li><li>Custom photo printing</li></ul>',
      images: [],
      regularPrice: 999,
      salePrice: 699,
      stock: 50,
      collections: [colMap['personalized-gifts'], colMap['birthday-gifts']].filter(Boolean),
      variants: [],
      customFields: [{ label: 'Upload Your Photo', type: 'file', required: true }],
      giftWrap: { enabled: true, price: 49 },
      giftMessage: true,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
    {
      title: 'Premium Chocolate Gift Box',
      slug: 'premium-chocolate-gift-box',
      description: '<p>Indulge in our premium handcrafted chocolate collection. Available in multiple sizes and beautifully packaged for gifting.</p>',
      images: [],
      regularPrice: 799,
      salePrice: 599,
      stock: 100,
      collections: [colMap['birthday-gifts'], colMap['love-combos']].filter(Boolean),
      variants: [{ name: 'Size', type: 'size', options: [{ label: 'Small (6 pcs)', price: 0 }, { label: 'Medium (12 pcs)', price: 200 }, { label: 'Large (24 pcs)', price: 500 }] }],
      customFields: [],
      giftWrap: { enabled: true, price: 39 },
      giftMessage: true,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
    {
      title: 'Love Couple Photo Frame Combo',
      slug: 'love-couple-photo-frame-combo',
      description: '<p>A stunning combo of matching photo frames for couples. Each frame features premium quality and elegant design.</p>',
      images: [],
      regularPrice: 1499,
      salePrice: 999,
      stock: 30,
      collections: [colMap['love-combos'], colMap['anniversary-gifts']].filter(Boolean),
      variants: [{ name: 'Color', type: 'color', options: [{ label: 'Rose Gold', price: 0 }, { label: 'Silver', price: 0 }, { label: 'Black', price: 0 }] }],
      customFields: [{ label: 'Your Name', type: 'text', required: true }, { label: 'Partner Name', type: 'text', required: true }],
      giftWrap: { enabled: true, price: 59 },
      giftMessage: true,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
    {
      title: 'Customized Racing Helmet Miniature',
      slug: 'customized-racing-helmet-miniature',
      description: '<p>A premium miniature racing helmet that can be customized with any name or team design. Great for sports enthusiasts!</p>',
      images: [],
      regularPrice: 1299,
      salePrice: 899,
      stock: 25,
      collections: [colMap['personalized-gifts'], colMap['birthday-gifts']].filter(Boolean),
      variants: [],
      customFields: [{ label: 'Name on Helmet', type: 'text', required: true }, { label: 'Design Reference', type: 'file', required: false }],
      giftWrap: { enabled: true, price: 49 },
      giftMessage: false,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
    {
      title: 'Elegant Gift Bouquet',
      slug: 'elegant-gift-bouquet',
      description: '<p>A beautifully arranged bouquet combining chocolates, dry fruits, and decorative elements. Perfect for any celebration.</p>',
      images: [],
      regularPrice: 1999,
      salePrice: 1499,
      stock: 20,
      collections: [colMap['birthday-gifts'], colMap['wedding-gifts'], colMap['love-combos']].filter(Boolean),
      variants: [{ name: 'Size', type: 'size', options: [{ label: 'Standard', price: 0 }, { label: 'Premium', price: 500 }, { label: 'Royal', price: 1000 }] }],
      customFields: [{ label: 'Message Card Text', type: 'textarea', required: false }],
      giftWrap: { enabled: false, price: 0 },
      giftMessage: true,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
    {
      title: 'Return Gift Pack - Set of 10',
      slug: 'return-gift-pack-set-of-10',
      description: '<p>A premium pack of 10 return gifts suitable for birthday parties, baby showers, and other celebrations. Contact us for customization options.</p>',
      images: [],
      regularPrice: 0,
      salePrice: 0,
      stock: 999,
      collections: [colMap['return-gifts']].filter(Boolean),
      variants: [],
      customFields: [],
      giftWrap: { enabled: false, price: 0 },
      giftMessage: false,
      isQuoteOnly: true,
      isFeatured: false,
      isActive: true,
    },
    {
      title: 'Personalized LED Name Lamp',
      slug: 'personalized-led-name-lamp',
      description: '<p>A custom LED lamp with your name beautifully crafted. Makes for a perfect bedside lamp and a unique gift.</p>',
      images: [],
      regularPrice: 599,
      salePrice: 449,
      stock: 75,
      collections: [colMap['personalized-gifts'], colMap['birthday-gifts']].filter(Boolean),
      variants: [{ name: 'Color', type: 'color', options: [{ label: 'Warm White', price: 0 }, { label: 'RGB (16 Colors)', price: 100 }] }],
      customFields: [{ label: 'Name to Print', type: 'text', required: true }],
      giftWrap: { enabled: true, price: 29 },
      giftMessage: true,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
    {
      title: 'Luxury Gift Hamper - Gold Edition',
      slug: 'luxury-gift-hamper-gold-edition',
      description: '<p>An exquisite luxury gift hamper featuring premium dry fruits, chocolates, scented candles, and a personalized message card. Perfect for weddings and corporate gifting.</p>',
      images: [],
      regularPrice: 3999,
      salePrice: 2999,
      stock: 15,
      collections: [colMap['wedding-gifts'], colMap['corporate-gifts'], colMap['festive-gifts']].filter(Boolean),
      variants: [],
      customFields: [{ label: 'Personalized Message', type: 'textarea', required: false }],
      giftWrap: { enabled: false, price: 0 },
      giftMessage: true,
      isQuoteOnly: false,
      isFeatured: true,
      isActive: true,
    },
  ];

  for (const prod of products) {
    await db.collection('products').updateOne(
      { slug: prod.slug },
      { $setOnInsert: { ...prod, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('Products seeded (8 sample products)');

  // 5. Seed Pages
  const pages = [
    { title: 'About Us', slug: 'about', type: 'about', content: '<h2>About GroveryGiftz</h2><p>Welcome to GroveryGiftz - your one-stop destination for thoughtful, premium gifts! We believe that gifting is an art. Whether it\'s a birthday surprise, a romantic gesture, or a festive celebration, we curate the finest gift items to make every moment special.</p><h3>Our Mission</h3><p>To make gifting easy, meaningful, and delightful. We handpick products that bring joy and help you express your love, gratitude, and celebration in the most beautiful way.</p>' },
    { title: 'Privacy Policy', slug: 'privacy-policy', type: 'privacy-policy', content: '<h2>Privacy Policy</h2><p>Your privacy is important to us. This privacy policy explains what personal data we collect and how we use it.</p><h3>Information We Collect</h3><p>We collect information you provide directly, such as your name, email, phone number, and shipping address when you place an order or create an account.</p><h3>How We Use Your Information</h3><p>We use the information to process orders, communicate with you, and improve our services.</p>' },
    { title: 'Terms & Conditions', slug: 'terms-conditions', type: 'terms-conditions', content: '<h2>Terms & Conditions</h2><p>By using our website, you agree to these terms and conditions.</p><h3>Orders</h3><p>All orders are subject to availability and confirmation of the order price.</p><h3>Delivery</h3><p>We aim to deliver within 3-5 working days. Delivery times may vary based on location.</p>' },
    { title: 'Shipping Policy', slug: 'shipping-policy', type: 'shipping-policy', content: '<h2>Shipping Policy</h2><p>Delivery within Tamil Nadu is free. Orders outside Tamil Nadu may include a delivery charge set by the store team.</p><h3>Delivery Timeline</h3><p>Tamil Nadu orders usually deliver within 8 days. Other states may take longer based on courier movement.</p><p>We deliver across India through our trusted courier partners.</p>' },
    { title: 'Cancellation & Refund Policy', slug: 'refund-policy', type: 'refund-policy', content: '<h2>Cancellation & Refund Policy</h2><p>Orders can be cancelled within 24 hours of placing. For personalized products, cancellation is not possible once production has started.</p><h3>Refunds</h3><p>Refunds will be processed within 7-10 business days after the returned product is received and inspected.</p>' },
  ];

  for (const page of pages) {
    await db.collection('pages').updateOne(
      { slug: page.slug },
      { $setOnInsert: { ...page, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('Pages seeded');

  // 6. Seed Banners
  const banners = [
    { title: 'Make Every Moment Special', subtitle: 'Discover unique personalized gifts for your loved ones', image: '', link: '/shop', buttonText: 'Shop Now', order: 1, isActive: true },
    { title: 'Birthday Gift Collections', subtitle: 'Find the perfect birthday surprise', image: '', link: '/collections/birthday-gifts', buttonText: 'Explore', order: 2, isActive: true },
    { title: 'Love Combos', subtitle: 'Express your love with our curated combos', image: '', link: '/collections/love-combos', buttonText: 'Shop Love', order: 3, isActive: true },
  ];

  for (const banner of banners) {
    await db.collection('banners').updateOne(
      { title: banner.title },
      { $setOnInsert: { ...banner, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('Banners seeded');

  console.log('\nSeed completed successfully!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });

