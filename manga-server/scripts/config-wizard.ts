#!/usr/bin/env bun

/**
 * Configuration Wizard Script
 * Interactive configuration wizard for manga server
 */

import autoConfigurator from '../src/config/auto-configurator';

async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      🎯 MANGA SERVER CONFIGURATION WIZARD 🎯              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nThis wizard will guide you through configuring your manga server.\n');
  
  try {
    // Always run in interactive mode
    const config = await autoConfigurator.run({
      interactive: true,
      force: process.argv.includes('--force')
    });
    
    console.log('\n✨ Configuration complete!');
    console.log('\n🚀 Ready to start your server with:');
    console.log('   bun run start\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Configuration wizard failed:', error);
    process.exit(1);
  }
}

// Run the wizard
if (import.meta.main) {
  main();
}