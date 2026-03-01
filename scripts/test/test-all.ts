#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 * Runs all email, SMS, and integration tests
 * 
 * Usage:
 *   npx tsx scripts/test/test-all.ts
 * 
 * Or with options:
 *   npx tsx scripts/test/test-all.ts --email test@example.com
 *   npx tsx scripts/test/test-all.ts --sms +15551234567
 *   npx tsx scripts/test/test-all.ts --email test@example.com --sms +15551234567
 *   npx tsx scripts/test/test-all.ts --integration
 *   npx tsx scripts/test/test-all.ts --all --email test@example.com --sms +15551234567
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestOptions {
  email?: string;
  sms?: string;
  integration?: boolean;
  all?: boolean;
}

function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        options.email = args[++i];
        break;
      case '--sms':
        options.sms = args[++i];
        break;
      case '--integration':
        options.integration = true;
        break;
      case '--all':
        options.all = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
🧪 SealSend Test Runner

Usage:
  npx tsx scripts/test/test-all.ts [options]

Options:
  --email <address>     Run email tests with this recipient
  --sms <number>        Run SMS tests with this phone number
  --integration         Run integration tests
  --all                 Run all tests (requires --email and --sms)
  --help, -h            Show this help message

Examples:
  # Test email only
  npx tsx scripts/test/test-all.ts --email test@example.com

  # Test SMS only
  npx tsx scripts/test/test-all.ts --sms +15551234567

  # Test everything
  npx tsx scripts/test/test-all.ts --all --email test@example.com --sms +15551234567
`);
}

function runTest(script: string, args: string[]): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const fullPath = resolve(__dirname, script);
    const child = spawn('npx', ['tsx', fullPath, ...args], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      process.stderr.write(str);
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output + errorOutput,
      });
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🚀 SealSend Test Suite (Mailgun + Twilio)\n');
  console.log('═══════════════════════════════════════\n');

  // Check if any tests requested
  if (!options.email && !options.sms && !options.integration) {
    if (options.all) {
      console.error('❌ --all requires --email and --sms options');
      showHelp();
      process.exit(1);
    }
    console.log('ℹ️  No tests specified. Use --help for usage information.\n');
    showHelp();
    process.exit(0);
  }

  const results: Array<{ name: string; success: boolean }> = [];

  // Email tests
  if (options.email || options.all) {
    if (!options.email) {
      console.error('❌ Email tests require --email <address>');
      process.exit(1);
    }

    console.log('📧 RUNNING EMAIL TESTS');
    console.log('───────────────────────\n');
    const emailResult = await runTest('test-email.ts', [options.email]);
    results.push({ name: 'Email Tests', success: emailResult.success });
    console.log('\n');
  }

  // SMS tests
  if (options.sms || options.all) {
    if (!options.sms) {
      console.error('❌ SMS tests require --sms <number>');
      process.exit(1);
    }

    console.log('📱 RUNNING SMS TESTS');
    console.log('─────────────────────\n');
    const smsResult = await runTest('test-sms.ts', [options.sms]);
    results.push({ name: 'SMS Tests', success: smsResult.success });
    console.log('\n');
  }

  // Integration tests
  if (options.integration || options.all) {
    console.log('🔗 RUNNING INTEGRATION TESTS');
    console.log('────────────────────────────\n');
    const integrationResult = await runTest('test-integration.ts', []);
    results.push({ name: 'Integration Tests', success: integrationResult.success });
    console.log('\n');
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📊 FINAL TEST SUMMARY\n');

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`\n${passed}/${total} test suites passed`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Your SealSend setup is working correctly.');
    console.log('\n📋 You can now:');
    console.log('   1. Create events through the dashboard');
    console.log('   2. Add guests and send invitations');
    console.log('   3. Track delivery status in the database');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Verify all environment variables are set correctly');
    console.log('   - Check that Resend/Twilio accounts are active');
    console.log('   - Ensure domains and phone numbers are verified');
    console.log('   - Review error messages in the test output above');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
