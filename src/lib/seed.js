const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/groverygiftz';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || '';
  if (!adminEmail || !adminPasswordPlain) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the admin account.');
  }

  // 1. Seed Admin
  const adminPassword = await bcrypt.hash(adminPasswordPlain, 12);
  await db.collection('admins').updateOne(
    { email: adminEmail },
    {
      $set: { name: 'Admin', email: adminEmail, password: adminPassword, role: 'superadmin', updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log('Admin seeded / updated');

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
    { title: 'About Us', slug: 'about', type: 'about', content: '<h2>About GroveryGiftz</h2><p>Welcome to GroveryGiftz - your one-stop destination for thoughtful, premium gifts! We believe that gifting is an art. Whether it is a birthday surprise, a romantic gesture, or a festive celebration, we curate the finest gift items to make every moment special.</p><h3>Our Mission</h3><p>To make gifting easy, meaningful, and delightful. We handpick products that bring joy and help you express your love, gratitude, and celebration in the most beautiful way.</p>' },
    { title: 'Privacy Policy', slug: 'privacy-policy', type: 'privacy-policy', content: `<p>At GroveryGiftz, we value your privacy and are committed to protecting your personal information.</p><h2>Information We Collect</h2><p>We may collect:</p><ul><li>Name</li><li>Mobile Number</li><li>Email Address</li><li>Shipping Address</li><li>Uploaded Photos</li><li>Payment Information, processed securely through payment gateways</li></ul><h2>How We Use Your Information</h2><p>We use your information to:</p><ul><li>Process and deliver your orders</li><li>Create personalized products</li><li>Provide customer support</li><li>Send order updates</li><li>Improve our services</li></ul><h2>Photo Privacy</h2><p>Your uploaded photos are used only for creating your personalized products. We never sell or share your photos with third parties without your permission.</p><h2>Payment Security</h2><p>Payments are processed through secure payment gateways. We do not store your debit or credit card details.</p><h2>Cookies</h2><p>Our website may use cookies to improve your browsing experience.</p><h2>Data Protection</h2><p>We take reasonable security measures to protect your personal information.</p><h2>Contact</h2><p>For any privacy-related concerns:</p><p><strong>Email:</strong> <a href="mailto:Groverygiftz@gmail.com">Groverygiftz@gmail.com</a><br /><strong>WhatsApp:</strong> <a href="https://wa.me/919994549781">+919994549781</a></p>` },
    { title: 'Terms & Conditions', slug: 'terms-conditions', type: 'terms-conditions', content: `<p>Welcome to GroveryGiftz.</p><p>By placing an order on our website, you agree to the following terms:</p><h2>Personalized Products</h2><p>All products are customized according to the images and details provided by the customer.</p><h2>Customer Responsibility</h2><p>Customers are responsible for:</p><ul><li>Uploading high-quality images</li><li>Providing correct shipping address</li><li>Providing correct contact information</li></ul><p>We are not responsible for printing issues caused by low-quality images submitted by customers.</p><h2>Design</h2><p>Minor adjustments such as cropping, brightness, and alignment may be done to achieve the best final result.</p><h2>Order Confirmation</h2><p>Orders will be processed only after successful payment.</p><h2>Delivery</h2><p>Delivery timelines may vary due to courier delays, festivals, weather conditions, or unforeseen circumstances.</p><h2>Intellectual Property</h2><p>All website content, product images, logos, and designs belong to GroveryGiftz and may not be copied without permission.</p><h2>Rights</h2><p>GroveryGiftz reserves the right to refuse or cancel any order if necessary.</p>` },
    { title: 'Shipping Policy', slug: 'shipping-policy', type: 'shipping-policy', content: `<p>We strive to deliver every personalized order safely and on time.</p><h2>Order Processing</h2><p>Since every product is custom-made:</p><p><strong>Dispatch Time:</strong> Within 6 Working Days</p><h2>Delivery Time</h2><p>After dispatch:</p><p><strong>Estimated Delivery:</strong> 2 Working Days</p><p>Delivery timelines may vary depending on the customer's location and courier service.</p><h2>Shipping Charges</h2><p>Shipping charges, if applicable, will be shown during checkout.</p><h2>Tracking</h2><p>Tracking details will be shared once your order is dispatched.</p><h2>Delays</h2><p>Unexpected delays due to weather, courier issues, strikes, or natural disasters are beyond our control.</p><h2>Damaged Package</h2><p>If your package is received in damaged condition, please contact us within 24 hours with photos and an unboxing video.</p>` },
    { title: 'Cancellation & Refund Policy', slug: 'refund-policy', type: 'refund-policy', content: `<p>As our products are personalized and custom-made, the following policy applies.</p><h2>Cancellation</h2><p>Orders can only be cancelled before production begins.</p><p>Once customization has started, cancellation is not possible.</p><h2>Refund</h2><p>Customized products are not eligible for refund unless:</p><ul><li>Wrong product delivered</li><li>Product received damaged</li><li>Manufacturing defect</li></ul><h2>Replacement Policy</h2><p>We take utmost care in packaging every order. However, if your product is damaged during transit due to courier mishandling, we will provide a free replacement, subject to verification.</p><p>To be eligible for a replacement, please contact us within 24 hours of delivery and provide:</p><ul><li>A complete unboxing video from opening the sealed package until the damaged product is visible</li><li>Clear photos of the damaged product</li><li>Photos of the outer packaging, if damaged</li></ul><p>If a replacement is approved, the customer must return the damaged product to us.</p><p>Once we receive the returned product, we will manufacture a new replacement product and dispatch it within 2 working days.</p><h2>Please Note</h2><ul><li>Replacement requests without an unboxing video may not be eligible.</li><li>Minor variations in color or appearance due to screen settings are not considered defects.</li><li>Damage caused after delivery due to customer handling is not eligible for replacement.</li></ul><p>Please review your order carefully before placing it.</p><h2>Contact Us</h2><p>For any support regarding your order:</p><p><strong>Email:</strong> Groverygiftz<br /><strong>WhatsApp:</strong> <a href="https://wa.me/919994549781">+919994549781</a></p>` },
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

