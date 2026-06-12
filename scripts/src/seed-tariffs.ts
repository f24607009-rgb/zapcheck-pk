import postgres from "postgres";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const sql = postgres(process.env.DATABASE_URL!);

async function seed() {
  console.log("Seeding tariff data...");

  // Clear existing tariffs
  await sql`DELETE FROM tariffs`;

  // NEPRA 2025 Energy Tariff Slabs
  await sql`
    INSERT INTO tariffs (slab_name, min_units, max_units, rate_per_unit, fixed_charges, is_active)
    VALUES
      ('1-100 Units', 0, 100, 19.00, 150, true),
      ('101-200 Units', 101, 200, 24.43, 150, true),
      ('201-300 Units', 201, 300, 29.15, 150, true),
      ('301-400 Units', 301, 400, 34.51, 150, true),
      ('401-500 Units', 401, 500, 40.08, 150, true),
      ('501-600 Units', 501, 600, 42.25, 150, true),
      ('601-700 Units', 601, 700, 42.25, 150, true),
      ('700+ Units', 701, 99999, 45.78, 150, true)
  `;

  console.log("✓ Tariff data seeded successfully!");
  await sql.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });