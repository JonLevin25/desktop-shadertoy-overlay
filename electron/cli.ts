/**
 * CLI argument parsing for the application.
 */

export interface CliOptions {
  /** Path to a shader file to load for testing */
  testShaderPath: string | null;
}

/**
 * Parse command-line arguments and return structured options.
 */
export function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    testShaderPath: null,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--shader' || args[i] === '-s') {
      if (i + 1 < args.length) {
        options.testShaderPath = args[i + 1];
        console.log('CLI: Will load test shader:', options.testShaderPath);
        i++; // Skip the next argument since we consumed it
      }
    }
  }

  return options;
}
