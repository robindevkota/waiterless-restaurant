import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Restaurant from './models/Restaurant';
import User from './models/User';
import Table from './models/Table';
import MenuCategory from './models/MenuCategory';
import MenuItem from './models/MenuItem';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/waiterless';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Wipe existing data
  await Promise.all([
    Restaurant.deleteMany({}),
    User.deleteMany({}),
    Table.deleteMany({}),
    MenuCategory.deleteMany({}),
    MenuItem.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── 1. Platform Admin ──────────────────────────────────────────────────────
  const platformAdmin = await User.create({
    restaurantId: null,
    name: 'Platform Admin',
    email: 'admin@waiterless.app',
    passwordHash: 'Admin@1234',
    role: 'platform_admin',
    status: 'active',
  });
  console.log('Platform admin created: admin@waiterless.app / Admin@1234');

  // ── 2. Restaurant A — "The Golden Fork" ───────────────────────────────────
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const restaurantA = await Restaurant.create({
    slug: 'golden-fork',
    name: 'The Golden Fork',
    ownerId: platformAdmin._id, // will be updated
    branding: {
      primaryColor: '#C9861A',
      secondaryColor: '#1A1A2E',
      accentColor: '#F5A623',
      backgroundColor: '#FFFDF5',
      fontFamily: 'Georgia',
      restaurantName: 'The Golden Fork',
      tagline: 'Fine dining, zero waiting',
    },
    subscription: { plan: 'pro', status: 'active', trialEndsAt: trialEnd, currentPeriodEnd: trialEnd },
    settings: { currency: 'NPR', vatRate: 13, timezone: 'Asia/Kathmandu', allowGuestNotes: true, autoCloseAfterMinutes: 180 },
  });

  const ownerA = await User.create({
    restaurantId: restaurantA._id,
    name: 'Aarav Sharma',
    email: 'owner@goldenfork.com',
    passwordHash: 'Owner@1234',
    role: 'owner',
    status: 'active',
  });
  restaurantA.ownerId = ownerA._id as any;
  await restaurantA.save();

  const cashierA = await User.create({
    restaurantId: restaurantA._id,
    name: 'Sita Thapa',
    email: 'cashier@goldenfork.com',
    passwordHash: 'Cashier@1234',
    role: 'cashier',
    status: 'active',
  });

  const kitchenA = await User.create({
    restaurantId: restaurantA._id,
    name: 'Ram Gurung',
    email: 'kitchen@goldenfork.com',
    passwordHash: 'Kitchen@1234',
    role: 'kitchen',
    status: 'active',
  });

  console.log('Restaurant A staff created: owner / cashier / kitchen @goldenfork.com / *@1234');

  // Tables for Restaurant A
  const tablesA = await Table.insertMany([
    { restaurantId: restaurantA._id, label: 'Table 1', capacity: 2, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantA._id, label: 'Table 2', capacity: 4, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantA._id, label: 'Table 3', capacity: 4, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantA._id, label: 'Table 4', capacity: 6, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantA._id, label: 'Patio 1', capacity: 4, qrToken: crypto.randomBytes(24).toString('hex') },
  ]);
  console.log(`Created ${tablesA.length} tables for Golden Fork`);

  // Menu for Restaurant A
  const catStarters = await MenuCategory.create({ restaurantId: restaurantA._id, name: 'Starters', sortOrder: 1 });
  const catMains    = await MenuCategory.create({ restaurantId: restaurantA._id, name: 'Mains', sortOrder: 2 });
  const catDesserts = await MenuCategory.create({ restaurantId: restaurantA._id, name: 'Desserts', sortOrder: 3 });
  const catDrinks   = await MenuCategory.create({ restaurantId: restaurantA._id, name: 'Drinks', sortOrder: 4 });

  await MenuItem.insertMany([
    // Starters
    { restaurantId: restaurantA._id, categoryId: catStarters._id, name: 'Momo (8 pcs)', description: 'Steamed or fried dumplings with tomato chutney', price: 220, available: true, tags: [], preparationTime: 10, sortOrder: 1 },
    { restaurantId: restaurantA._id, categoryId: catStarters._id, name: 'Chicken Sekuwa', description: 'Grilled spiced chicken skewers', price: 350, available: true, tags: ['spicy'], preparationTime: 15, sortOrder: 2 },
    { restaurantId: restaurantA._id, categoryId: catStarters._id, name: 'Vegetable Spring Roll', description: 'Crispy rolls with mixed vegetables', price: 180, available: true, tags: ['vegan'], preparationTime: 10, sortOrder: 3 },
    // Mains
    { restaurantId: restaurantA._id, categoryId: catMains._id, name: 'Dal Bhat Set', description: 'Traditional Nepali meal with rice, lentils, vegetables and pickle', price: 380, available: true, tags: ['vegetarian'], preparationTime: 20, sortOrder: 1 },
    { restaurantId: restaurantA._id, categoryId: catMains._id, name: 'Chicken Thali', description: 'Rice, lentils, chicken curry, vegetables and pickle', price: 480, available: true, tags: [], preparationTime: 20, sortOrder: 2 },
    { restaurantId: restaurantA._id, categoryId: catMains._id, name: 'Mutton Curry', description: 'Slow-cooked mutton in Nepali spices', price: 580, available: true, tags: ['spicy'], preparationTime: 25, sortOrder: 3 },
    { restaurantId: restaurantA._id, categoryId: catMains._id, name: 'Paneer Butter Masala', description: 'Cottage cheese in rich tomato gravy', price: 420, available: true, tags: ['vegetarian'], preparationTime: 15, sortOrder: 4 },
    // Desserts
    { restaurantId: restaurantA._id, categoryId: catDesserts._id, name: 'Kheer', description: 'Creamy rice pudding with cardamom', price: 150, available: true, tags: ['vegetarian'], preparationTime: 5, sortOrder: 1 },
    { restaurantId: restaurantA._id, categoryId: catDesserts._id, name: 'Gulab Jamun (3 pcs)', description: 'Soft milk dumplings in sugar syrup', price: 140, available: true, tags: ['vegetarian'], preparationTime: 5, sortOrder: 2 },
    // Drinks
    { restaurantId: restaurantA._id, categoryId: catDrinks._id, name: 'Lassi', description: 'Chilled yogurt drink — sweet or salted', price: 120, available: true, tags: ['vegetarian'], preparationTime: 3, sortOrder: 1 },
    { restaurantId: restaurantA._id, categoryId: catDrinks._id, name: 'Masala Tea', description: 'Spiced milk tea', price: 80, available: true, tags: ['vegetarian'], preparationTime: 5, sortOrder: 2 },
    { restaurantId: restaurantA._id, categoryId: catDrinks._id, name: 'Fresh Lime Soda', description: 'Lime juice with soda water', price: 100, available: true, tags: ['vegan'], preparationTime: 3, sortOrder: 3 },
    { restaurantId: restaurantA._id, categoryId: catDrinks._id, name: 'Cold Coffee', description: 'Blended iced coffee with milk', price: 160, available: true, tags: ['vegetarian'], preparationTime: 5, sortOrder: 4 },
  ]);
  console.log('Created menu for Golden Fork (13 items)');

  // ── 3. Restaurant B — "Spice Garden" ──────────────────────────────────────
  const restaurantB = await Restaurant.create({
    slug: 'spice-garden',
    name: 'Spice Garden',
    ownerId: platformAdmin._id,
    branding: {
      primaryColor: '#2E7D32',
      secondaryColor: '#1B5E20',
      accentColor: '#81C784',
      backgroundColor: '#F9FBF9',
      fontFamily: 'Inter',
      restaurantName: 'Spice Garden',
      tagline: 'Authentic flavors, modern comfort',
    },
    subscription: { plan: 'basic', status: 'active', trialEndsAt: trialEnd, currentPeriodEnd: trialEnd },
    settings: { currency: 'NPR', vatRate: 13, timezone: 'Asia/Kathmandu', allowGuestNotes: true, autoCloseAfterMinutes: 120 },
  });

  const ownerB = await User.create({
    restaurantId: restaurantB._id,
    name: 'Priya Rai',
    email: 'owner@spicegarden.com',
    passwordHash: 'Owner@1234',
    role: 'owner',
    status: 'active',
  });
  restaurantB.ownerId = ownerB._id as any;
  await restaurantB.save();

  await User.create({
    restaurantId: restaurantB._id,
    name: 'Bikash Tamang',
    email: 'cashier@spicegarden.com',
    passwordHash: 'Cashier@1234',
    role: 'cashier',
    status: 'active',
  });

  await User.create({
    restaurantId: restaurantB._id,
    name: 'Nisha Karki',
    email: 'kitchen@spicegarden.com',
    passwordHash: 'Kitchen@1234',
    role: 'kitchen',
    status: 'active',
  });

  console.log('Restaurant B staff created: owner / cashier / kitchen @spicegarden.com / *@1234');

  // Tables for Restaurant B
  await Table.insertMany([
    { restaurantId: restaurantB._id, label: 'Table A', capacity: 2, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantB._id, label: 'Table B', capacity: 4, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantB._id, label: 'Table C', capacity: 4, qrToken: crypto.randomBytes(24).toString('hex') },
    { restaurantId: restaurantB._id, label: 'Table D', capacity: 6, qrToken: crypto.randomBytes(24).toString('hex') },
  ]);

  // Menu for Restaurant B
  const catBurger  = await MenuCategory.create({ restaurantId: restaurantB._id, name: 'Burgers', sortOrder: 1 });
  const catPasta   = await MenuCategory.create({ restaurantId: restaurantB._id, name: 'Pasta', sortOrder: 2 });
  const catSides   = await MenuCategory.create({ restaurantId: restaurantB._id, name: 'Sides', sortOrder: 3 });
  const catBevB    = await MenuCategory.create({ restaurantId: restaurantB._id, name: 'Beverages', sortOrder: 4 });

  await MenuItem.insertMany([
    { restaurantId: restaurantB._id, categoryId: catBurger._id, name: 'Classic Beef Burger', description: 'Juicy beef patty with lettuce, tomato, pickles', price: 420, available: true, tags: [], preparationTime: 12, sortOrder: 1 },
    { restaurantId: restaurantB._id, categoryId: catBurger._id, name: 'Spicy Chicken Burger', description: 'Crispy fried chicken with spicy sauce', price: 380, available: true, tags: ['spicy'], preparationTime: 12, sortOrder: 2 },
    { restaurantId: restaurantB._id, categoryId: catBurger._id, name: 'Veggie Burger', description: 'Grilled veggie patty with avocado', price: 320, available: true, tags: ['vegan'], preparationTime: 10, sortOrder: 3 },
    { restaurantId: restaurantB._id, categoryId: catPasta._id, name: 'Spaghetti Bolognese', description: 'Classic meat sauce pasta', price: 450, available: true, tags: [], preparationTime: 15, sortOrder: 1 },
    { restaurantId: restaurantB._id, categoryId: catPasta._id, name: 'Penne Arrabbiata', description: 'Spicy tomato sauce with garlic', price: 380, available: true, tags: ['vegan', 'spicy'], preparationTime: 12, sortOrder: 2 },
    { restaurantId: restaurantB._id, categoryId: catSides._id, name: 'Crispy Fries', description: 'Golden salted french fries', price: 160, available: true, tags: ['vegan'], preparationTime: 8, sortOrder: 1 },
    { restaurantId: restaurantB._id, categoryId: catSides._id, name: 'Garden Salad', description: 'Fresh mixed greens with vinaigrette', price: 200, available: true, tags: ['vegan'], preparationTime: 5, sortOrder: 2 },
    { restaurantId: restaurantB._id, categoryId: catBevB._id, name: 'Coca Cola', description: '330ml chilled can', price: 80, available: true, tags: ['vegan'], preparationTime: 1, sortOrder: 1 },
    { restaurantId: restaurantB._id, categoryId: catBevB._id, name: 'Fresh Juice', description: 'Seasonal fresh fruit juice', price: 140, available: true, tags: ['vegan'], preparationTime: 5, sortOrder: 2 },
    { restaurantId: restaurantB._id, categoryId: catBevB._id, name: 'Milkshake', description: 'Chocolate, vanilla or strawberry', price: 220, available: true, tags: ['vegetarian'], preparationTime: 5, sortOrder: 3 },
  ]);
  console.log('Created menu for Spice Garden (10 items)');

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Seed complete. Login credentials:');
  console.log('───────────────────────────────────────────────');
  console.log('  Platform Admin : admin@waiterless.app        / Admin@1234');
  console.log('  Golden Fork    : owner@goldenfork.com        / Owner@1234');
  console.log('                 : cashier@goldenfork.com      / Cashier@1234');
  console.log('                 : kitchen@goldenfork.com      / Kitchen@1234');
  console.log('  Spice Garden   : owner@spicegarden.com       / Owner@1234');
  console.log('                 : cashier@spicegarden.com     / Cashier@1234');
  console.log('                 : kitchen@spicegarden.com     / Kitchen@1234');
  console.log('═══════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
