import { bankProblems } from './questions.ts';

const problems = bankProblems();
if (problems.length > 0) {
  console.error(`Question bank validation failed (${problems.length} problems found):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('✓ Question bank passed validation.');
