/**
 * Hard-delete a tenant and every document it owns, by slug.
 * Usage: npx ts-node src/scripts/delete-tenant.ts <slug> [<slug> ...]
 */
import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  const slugs = process.argv.slice(2);
  if (!slugs.length) {
    console.error('Usage: npx ts-node src/scripts/delete-tenant.ts <slug> [<slug> ...]');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const restaurants = db.collection('restaurants');

  for (const slug of slugs) {
    const r = await restaurants.findOne({ slug });
    if (!r) {
      console.log(`- ${slug}: not found, skipping`);
      continue;
    }
    const rid = r._id;
    const owned = [
      'users', 'tables', 'tablesessions', 'orders', 'bills',
      'menucategories', 'menuitems', 'ingredients', 'stocklogs', 'aireports',
    ];
    console.log(`Deleting tenant "${slug}" (${rid}):`);
    for (const coll of owned) {
      const { deletedCount } = await db.collection(coll).deleteMany({ restaurantId: rid });
      if (deletedCount) console.log(`  ${coll}: ${deletedCount}`);
    }
    await restaurants.deleteOne({ _id: rid });
    console.log(`  restaurant document removed`);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
