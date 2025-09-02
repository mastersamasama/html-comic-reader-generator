#!/usr/bin/env bun

/**
 * Auto-Setup Script
 * Automatically configures the manga server based on system specifications
 */

import autoConfigurator from '../src/config/auto-configurator';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          🚀 MANGA SERVER AUTO-SETUP 🚀                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      interactive: args.includes('--interactive') || args.includes('-i'),
      force: args.includes('--force') || args.includes('-f'),
      testOnly: args.includes('--test') || args.includes('-t'),
      silent: args.includes('--silent') || args.includes('-s')
    };
    
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }
    
    if (args.includes('--reset')) {
      await autoConfigurator.reset();
      return;
    }
    
    if (args.includes('--show')) {
      await autoConfigurator.showConfig();
      return;
    }
    
    // Run auto-configuration
    const config = await autoConfigurator.run(options);
    
    if (!options.silent && !options.testOnly) {
      console.log('\n✨ Your manga server is configured and ready!');
      console.log('\nQuick start commands:');
      console.log('   bun run start        # Start the server');
      console.log('   bun run genshelf     # Generate manga library');
      console.log('   bun run config:show  # View configuration');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Auto-setup failed:', error);
    console.log('\nTry running with --interactive flag for manual configuration');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Usage: bun run config:auto [options]

Options:
  -i, --interactive    Run interactive configuration wizard
  -f, --force         Force regeneration of configuration
  -t, --test          Test configuration without applying
  -s, --silent        Suppress output (except errors)
  --reset             Reset all configuration
  --show              Display current configuration
  -h, --help          Show this help message

Examples:
  bun run config:auto              # Auto-detect and configure
  bun run config:auto -i           # Interactive configuration
  bun run config:auto -f           # Force reconfiguration
  bun run config:auto --test       # Test configuration only
  bun run config:auto --reset      # Reset to defaults
  `);
}

// Run the script
if (import.meta.main) {
  main();
}