#!/usr/bin/env node
/**
 * Test video generation end-to-end with DB formats and styles.
 * Usage: npx tsx scripts/test-video-generation.ts
 */

import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { listFormatsFor } from '@/lib/storyboard/formats/repository';
import { listVisualStylesFor } from '@/lib/storyboard/visual-styles/repository';

const DEMO_SCRIPT = `
Our new product makes billing simple. The problem: spreadsheets are a nightmare.
Accountants waste hours checking numbers. Our solution: one-click export,
real-time sync, and instant reports. Now finance teams save 10 hours weekly.
Smart billing, for teams that move fast.
`;

async function main() {
  console.log('🎬 Test Video Generation - Format & Styles from Database\n');

  try {
    // 1. List available formats (org ID = null for shipped formats)
    console.log('📋 Loading formats...');
    const formats = await listFormatsFor(null);
    console.log(`   Found ${formats.length} formats:`);
    formats.forEach((f) => console.log(`   • ${f.label} (${f.id})`));

    if (formats.length === 0) {
      console.error('   ❌ No formats found. Run seed: npm run seed:video-formats');
      process.exit(1);
    }

    // 2. List available visual styles (org ID = null for shipped styles)
    console.log('\n🎨 Loading visual styles...');
    const styles = await listVisualStylesFor(null);
    console.log(`   Found ${styles.length} styles:`);
    styles.forEach((s) => console.log(`   • ${s.label} (${s.id})`));

    if (styles.length === 0) {
      console.error('   ❌ No styles found. Run seed: npm run seed:visual-styles');
      process.exit(1);
    }

    // 3. Pick first format and style for test
    const testFormat = formats[0];
    const testStyle = styles[0];

    console.log(`\n✅ Using format: ${testFormat.label}`);
    console.log(`✅ Using style: ${testStyle.label}`);

    // 4. Validate format structure
    console.log('\n📐 Format validation:');
    console.log(`   Paragraphs: ${testFormat.script.paragraphs}`);
    console.log(`   Structure: ${testFormat.script.structure.join(' → ')}`);

    // 5. Validate style configuration
    console.log('\n🎨 Style configuration:');
    console.log(`   Art direction: ${testStyle.artDirection}`);
    console.log(`   Accent colors: ${testStyle.accentColors.join(', ') || 'none'}`);
    console.log(`   Vocabulary: ${testStyle.vocabulary.join(', ')}`);
    console.log(`   Labels: ${testStyle.labels}`);

    // 6. Simulate payload that would be sent to generate-storyboard API
    console.log('\n📦 Test payload for /api/generate-storyboard:');
    const payload = {
      script: DEMO_SCRIPT,
      format: testFormat.id,
      aspectRatio: '16:9',
      language: 'en',
      duration: '2-3 minutes',
      targetAudience: 'finance-teams',
      tone: 'professional',
    };
    console.log(JSON.stringify(payload, null, 2));

    console.log('\n✨ Test setup complete!');
    console.log('   Next: Authenticate → Create project → POST /api/generate-storyboard');
    console.log(`\n   curl -X POST http://localhost:3000/api/generate-storyboard \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '${JSON.stringify(payload)}'`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
