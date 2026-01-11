import { database } from '@/config/database';
import { logger } from '@/utils/logger';
import { RowDataPacket } from 'mysql2';

interface SeedOptions {
  farmers?: number;
  products?: number;
  customers?: number;
  batchSize?: number;
}

const DEFAULT_OPTIONS: Required<SeedOptions> = {
  farmers: 1000,
  products: 1000000, // 1 million products as specified
  customers: 10000,
  batchSize: 1000,
};

// Sample data arrays
const FARMER_NAMES = [
  'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sunita Devi', 'Ravi Singh',
  'Meera Gupta', 'Suresh Yadav', 'Kavita Joshi', 'Manoj Verma', 'Anita Roy',
  'Deepak Mishra', 'Sita Ram', 'Vikash Kumar', 'Pooja Agarwal', 'Ramesh Chand',
  'Geeta Devi', 'Ashok Kumar', 'Rekha Singh', 'Naresh Patel', 'Usha Sharma'
];

const CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune',
  'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal',
  'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Coimbatore'
];

const STATES = [
  'Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu', 'West Bengal',
  'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'Andhra Pradesh',
  'Bihar', 'Punjab', 'Haryana', 'Kerala', 'Odisha', 'Jharkhand', 'Assam'
];

const PRODUCT_NAMES = [
  'Tomatoes', 'Onions', 'Potatoes', 'Carrots', 'Cabbage', 'Cauliflower',
  'Spinach', 'Lettuce', 'Broccoli', 'Bell Peppers', 'Cucumbers', 'Radish',
  'Apples', 'Bananas', 'Oranges', 'Mangoes', 'Grapes', 'Strawberries',
  'Rice', 'Wheat', 'Corn', 'Barley', 'Oats', 'Quinoa',
  'Lentils', 'Chickpeas', 'Black Beans', 'Kidney Beans', 'Green Peas',
  'Milk', 'Cheese', 'Yogurt', 'Butter', 'Cream',
  'Basil', 'Cilantro', 'Mint', 'Oregano', 'Thyme', 'Rosemary'
];

const CATEGORIES = [
  'Vegetables', 'Fruits', 'Grains', 'Pulses', 'Dairy', 'Herbs', 'Organic', 'Seasonal'
];

const DESCRIPTIONS = [
  'Fresh and organic', 'Locally grown', 'Premium quality', 'Farm fresh',
  'Naturally grown', 'Pesticide-free', 'Hand-picked', 'Seasonal harvest',
  'Traditional variety', 'High nutrition', 'Sun-dried', 'Cold-pressed'
];

class DatabaseSeeder {
  private db: any;

  async initialize(): Promise<void> {
    await database.initialize();
    this.db = database.getPool();
  }

  async seedFarmers(count: number, batchSize: number): Promise<void> {
    logger.info(`Seeding ${count} farmers...`);

    // Check if farmers already exist
    const [existing] = await this.db.execute('SELECT COUNT(*) as count FROM farmers');
    const existingCount = (existing as RowDataPacket[])[0].count;

    if (existingCount >= count) {
      logger.info(`Farmers already seeded (${existingCount} existing)`);
      return;
    }

    const farmersToCreate = count - existingCount;
    const batches = Math.ceil(farmersToCreate / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, farmersToCreate);
      const batchCount = batchEnd - batchStart;

      const values: any[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < batchCount; i++) {
        const farmerIndex = existingCount + batchStart + i;
        const name = `${FARMER_NAMES[farmerIndex % FARMER_NAMES.length]} ${farmerIndex}`;
        const email = `farmer${farmerIndex}@farmlokal.com`;
        const phone = `+91${9000000000 + farmerIndex}`;
        const city = CITIES[farmerIndex % CITIES.length];
        const state = STATES[farmerIndex % STATES.length];
        const verified = Math.random() > 0.2; // 80% verified
        const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(2));
        const totalReviews = Math.floor(Math.random() * 100);

        values.push(name, email, phone, `Address ${farmerIndex}`, city, state, `${110001 + farmerIndex}`, 'India', verified, rating, totalReviews);
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      }

      const query = `
        INSERT INTO farmers (name, email, phone, address, city, state, postal_code, country, verified, rating, total_reviews)
        VALUES ${placeholders.join(', ')}
      `;

      await this.db.execute(query, values);
      logger.info(`Seeded farmers batch ${batch + 1}/${batches} (${batchCount} farmers)`);
    }

    logger.info(`Successfully seeded ${farmersToCreate} farmers`);
  }

  async seedCustomers(count: number, batchSize: number): Promise<void> {
    logger.info(`Seeding ${count} customers...`);

    // Check if customers already exist
    const [existing] = await this.db.execute('SELECT COUNT(*) as count FROM customers');
    const existingCount = (existing as RowDataPacket[])[0].count;

    if (existingCount >= count) {
      logger.info(`Customers already seeded (${existingCount} existing)`);
      return;
    }

    const customersToCreate = count - existingCount;
    const batches = Math.ceil(customersToCreate / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, customersToCreate);
      const batchCount = batchEnd - batchStart;

      const values: any[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < batchCount; i++) {
        const customerIndex = existingCount + batchStart + i;
        const name = `Customer ${customerIndex}`;
        const email = `customer${customerIndex}@example.com`;
        const phone = `+91${8000000000 + customerIndex}`;
        const city = CITIES[customerIndex % CITIES.length];
        const state = STATES[customerIndex % STATES.length];

        values.push(name, email, phone, `Customer Address ${customerIndex}`, city, state, `${200001 + customerIndex}`);
        placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
      }

      const query = `
        INSERT INTO customers (name, email, phone, address, city, state, postal_code)
        VALUES ${placeholders.join(', ')}
      `;

      await this.db.execute(query, values);
      logger.info(`Seeded customers batch ${batch + 1}/${batches} (${batchCount} customers)`);
    }

    logger.info(`Successfully seeded ${customersToCreate} customers`);
  }

  async seedProducts(count: number, batchSize: number): Promise<void> {
    logger.info(`Seeding ${count} products...`);

    // Get farmer IDs
    const [farmers] = await this.db.execute('SELECT id FROM farmers WHERE verified = true');
    const farmerIds = (farmers as RowDataPacket[]).map(f => f.id);

    if (farmerIds.length === 0) {
      throw new Error('No verified farmers found. Please seed farmers first.');
    }

    // Check if products already exist
    const [existing] = await this.db.execute('SELECT COUNT(*) as count FROM products');
    const existingCount = (existing as RowDataPacket[])[0].count;

    if (existingCount >= count) {
      logger.info(`Products already seeded (${existingCount} existing)`);
      return;
    }

    const productsToCreate = count - existingCount;
    const batches = Math.ceil(productsToCreate / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, productsToCreate);
      const batchCount = batchEnd - batchStart;

      const values: any[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < batchCount; i++) {
        const productIndex = existingCount + batchStart + i;
        const baseName = PRODUCT_NAMES[productIndex % PRODUCT_NAMES.length];
        const name = `${baseName} ${Math.floor(productIndex / PRODUCT_NAMES.length) + 1}`;
        const description = `${DESCRIPTIONS[productIndex % DESCRIPTIONS.length]} ${baseName.toLowerCase()}`;
        const price = parseFloat((10 + Math.random() * 490).toFixed(2)); // ₹10 to ₹500
        const category = CATEGORIES[productIndex % CATEGORIES.length];
        const farmerId = farmerIds[productIndex % farmerIds.length];
        const stock = Math.floor(Math.random() * 1000) + 1; // 1 to 1000
        const unit = ['kg', 'gram', 'piece', 'liter', 'dozen'][productIndex % 5];
        const organic = Math.random() > 0.7; // 30% organic
        const seasonal = Math.random() > 0.8; // 20% seasonal

        // Generate dates
        const harvestDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
        const expiryDate = new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000); // Next 60 days

        values.push(
          name, description, price, category, farmerId, stock, unit,
          null, // image_url
          organic, seasonal,
          harvestDate.toISOString().split('T')[0],
          expiryDate.toISOString().split('T')[0]
        );
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      }

      const query = `
        INSERT INTO products (name, description, price, category, farmer_id, stock, unit, image_url, organic, seasonal, harvest_date, expiry_date)
        VALUES ${placeholders.join(', ')}
      `;

      await this.db.execute(query, values);
      
      const progress = ((batch + 1) / batches * 100).toFixed(1);
      logger.info(`Seeded products batch ${batch + 1}/${batches} (${batchCount} products) - ${progress}% complete`);
    }

    logger.info(`Successfully seeded ${productsToCreate} products`);
  }

  async close(): Promise<void> {
    await database.close();
  }
}

async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const seeder = new DatabaseSeeder();

  try {
    await seeder.initialize();
    
    logger.info('Starting database seeding...');
    logger.info(`Target: ${opts.farmers} farmers, ${opts.products} products, ${opts.customers} customers`);

    // Seed in order: farmers first, then customers, then products
    await seeder.seedFarmers(opts.farmers, opts.batchSize);
    await seeder.seedCustomers(opts.customers, opts.batchSize);
    await seeder.seedProducts(opts.products, opts.batchSize);

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  } finally {
    await seeder.close();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: SeedOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = parseInt(args[i + 1]);
    
    if (key && !isNaN(value)) {
      (options as any)[key] = value;
    }
  }

  seedDatabase(options)
    .then(() => {
      logger.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };