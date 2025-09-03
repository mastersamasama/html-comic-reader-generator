/**
 * Simple Input Handler
 * Clean, reliable input handling for Bun without echo duplication
 * Based on best practices and known solutions for readline issues
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Simple, reliable input handler that avoids terminal echo issues
 */
export class SimpleInput {
  // Single readline interface to avoid duplication issues
  private static rlInterface: any = null;
  
  /**
   * Get or create the readline interface
   * Using a singleton pattern to ensure only one interface exists
   */
  private static getInterface() {
    if (!this.rlInterface) {
      this.rlInterface = createInterface({
        input,
        output,
        terminal: false, // Critical: Always false to prevent echo duplication
        historySize: 0,  // Disable history to keep it simple
        crlfDelay: Infinity, // Recognize all instances of CR LF as a single line break
      });
    }
    return this.rlInterface;
  }
  
  /**
   * Clean up the interface when done
   */
  private static cleanup() {
    if (this.rlInterface) {
      this.rlInterface.close();
      this.rlInterface = null;
    }
  }
  
  /**
   * Simple prompt that works reliably across all terminals
   */
  static async prompt(question: string, defaultValue?: string): Promise<string> {
    try {
      const rl = this.getInterface();
      
      // Use the standard question method without any custom event handling
      const answer = await rl.question(question);
      
      // Return the answer or default
      return answer.trim() || defaultValue || '';
    } catch (error) {
      console.error('Input error:', error);
      // Return default on error
      return defaultValue || '';
    }
  }
  
  /**
   * Confirmation prompt
   */
  static async confirm(question: string, defaultYes: boolean = true): Promise<boolean> {
    const hint = defaultYes ? '(Y/n)' : '(y/N)';
    const fullQuestion = `${question} ${hint}: `;
    
    const answer = await this.prompt(fullQuestion, defaultYes ? 'y' : 'n');
    
    if (!answer.trim()) return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }
  
  /**
   * Clean up when the process exits
   */
  static {
    // Register cleanup handlers
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
  }
}

// Alternative implementation using console async iterator (Bun-specific)
export class BunInput {
  /**
   * Bun-specific input using async iterator
   * This approach has been reported to work well in Bun v1.1.17+
   */
  static async prompt(question: string, defaultValue?: string): Promise<string> {
    try {
      // Write the question
      process.stdout.write(question);
      
      // Use console async iterator for input
      const iterator = console[Symbol.asyncIterator]();
      const result = await iterator.next();
      
      // Clean up the iterator
      await iterator.return?.();
      
      // Return the value or default
      const answer = result.value?.trim() || '';
      return answer || defaultValue || '';
    } catch (error) {
      console.error('Input error:', error);
      // Fallback to SimpleInput on error
      return SimpleInput.prompt(question, defaultValue);
    }
  }
  
  /**
   * Confirmation prompt
   */
  static async confirm(question: string, defaultYes: boolean = true): Promise<boolean> {
    const hint = defaultYes ? '(Y/n)' : '(y/N)';
    const fullQuestion = `${question} ${hint}: `;
    
    const answer = await this.prompt(fullQuestion, defaultYes ? 'y' : 'n');
    
    if (!answer.trim()) return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }
}

// Export the most reliable implementation as default
export default SimpleInput;