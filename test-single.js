import { analyzeSource } from './src/parsers/codeParser.js';

const file = '/home/yousef/dev/E-commerce/services/Auth/src/config.js';
const results = analyzeSource(file);

console.log('Results:', JSON.stringify(results, null, 2));
console.log('Total findings:', results.length);
