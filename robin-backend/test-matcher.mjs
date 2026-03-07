import { matchKeywords, matchArticle, cleanArticleContent } from './src/services/keyword-matcher.js';

const keywords = ['Government of Orissa', 'Odisha Government', 'Orissa State Government', 'Secretary to Government', 'Bhubaneswar'];

// Test 1: Iran article with Orissa in footer (should NOT match Orissa keywords)
const iranContent = 'Iran Supreme Leader Khamenei was killed in an attack. The government condemned the strike. Several world leaders responded to the crisis affecting global stability. ' + 'x'.repeat(300) + ' PTI Orissa POST – Odisha No.1 English Daily';
console.log('=== Test 1: Iran + Orissa footer (should NOT match) ===');
const r1 = matchKeywords(iranContent, keywords);
console.log('Result:', r1.length === 0 ? 'NONE ✅' : r1.join(', ') + ' ❌');

// Test 2: Real Odisha article (SHOULD match)
const odishaContent = 'The Government of Odisha announced new policies. Chief Minister addressed Bhubaneswar assembly. Orissa state government plans infrastructure.';
console.log('\n=== Test 2: Real Odisha article (SHOULD match) ===');
const r2 = matchKeywords(odishaContent, keywords);
console.log('Result:', r2.length > 0 ? r2.join(', ') + ' ✅' : 'NONE ❌');

// Test 3: cleanArticleContent
console.log('\n=== Test 3: Content cleaning ===');
const dirty = 'Article about something. PTI Orissa POST – Odisha No.1 English Daily';
const cleaned = cleanArticleContent(dirty);
console.log('Cleaned:', JSON.stringify(cleaned));
console.log('Footer gone:', !cleaned.includes('Orissa POST') ? 'YES ✅' : 'NO ❌');

// Test 4: Words 500+ chars apart (should NOT match)
console.log('\n=== Test 4: Words far apart (should NOT match) ===');
const farText = 'The government issued a directive today. ' + 'A'.repeat(500) + ' Orissa news today.';
const r4 = matchKeywords(farText, ['Government of Orissa']);
console.log('Result:', r4.length === 0 ? 'NONE ✅' : r4.join(', ') + ' ❌');

// Test 5: Words close (SHOULD match)
console.log('\n=== Test 5: Words close together (SHOULD match) ===');
const closeText = 'Several government officials in the state of Orissa received awards.';
const r5 = matchKeywords(closeText, ['Government of Orissa']);
console.log('Result:', r5.length > 0 ? r5.join(', ') + ' ✅' : 'NONE ❌');

// Test 6: Exact phrase always works
console.log('\n=== Test 6: Exact phrase match ===');
const r6 = matchKeywords('The Government of Orissa launched a scheme.', ['Government of Orissa']);
console.log('Result:', r6.length > 0 ? r6.join(', ') + ' ✅' : 'NONE ❌');

console.log('\n=== ALL TESTS COMPLETE ===');
