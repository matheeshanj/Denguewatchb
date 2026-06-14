// db/reset.js
// Resets all district_stats, province_stats, and daily_trend to zero.
// Leaves the reports table untouched (preserves submissions).
//
// Run with: node db/reset.js
//   or add to package.json: "reset": "node db/reset.js"

require('dotenv').config();
const pool = require('./index');

async function reset() {
  console.log('Resetting all stats to zero…');

  await pool.query(`
    UPDATE district_stats
    SET cases = 0, deaths = 0, pct_of_max = 0, updated_at = now()
  `);
  console.log('✓ district_stats cleared');

  await pool.query(`
    UPDATE province_stats
    SET cases = 0, deaths = 0, severity = 'low', updated_at = now()
  `);
  console.log('✓ province_stats cleared');

  await pool.query(`DELETE FROM daily_trend`);
  console.log('✓ daily_trend cleared');

  console.log('Reset complete. All stats are now zero.');
  await pool.end();
}

reset().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
