// scripts/verify-pet-species.ts
// Locks in the classification the "Khác" species field depends on.
//
// The whole point of lib/petSpecies.ts is a trade-off: it must REJECT people and
// ACCEPT unusual animals. Both directions are regressions that would be caught
// by a customer rather than by CI, so they get an explicit table here.
//
// Run with: npx tsx scripts/verify-pet-species.ts

import { validatePetSpecies, SPECIES_SUGGESTIONS } from '../lib/petSpecies';

let passed = 0;
let failed = 0;

function expect(label: string, input: string, shouldPass: boolean, why: string) {
  const verdict = validatePetSpecies(input);
  const ok = verdict.ok === shouldPass;
  if (ok) {
    passed += 1;
    console.log(`  + ${label} -> ${shouldPass ? 'accept' : 'reject'}`);
  } else {
    failed += 1;
    const actual = verdict.ok ? 'accept' : `reject(${verdict.reason})`;
    console.log(`  x ${label} -> got ${actual}, expected ${shouldPass ? 'accept' : 'reject'}`);
    console.log(`      "${input}" - ${why}`);
  }
}

console.log('\n1. Real species must be accepted');
// The clinic markets exotic care, so these are the exact words a naive
// allow-list would have blocked.
expect('cho', 'chó', true, 'domestic');
expect('Cho', 'Chó', true, 'capitalised');
expect('meo', 'mèo', true, 'domestic');
expect('hamster', 'hamster', true, 'exotic, advertised by Belwee');
expect('chuot hamster', 'chuột hamster', true, 'exotic multi-word');
expect('alpaca', 'alpaca', true, 'advertised in the knowledge article');
expect('lac da alpaca', 'lạc đà alpaca', true, 'multi-word');
expect('tho', 'thỏ', true, 'small pet');
expect('soc', 'sóc', true, 'small pet');
expect('nhim', 'nhím', true, 'exotic, named in the brief');
expect('rua', 'rùa', true, 'exotic, named in the brief');
expect('chon suong', 'chồn sương', true, 'exotic, named in the brief');
expect('cho husky', 'chó husky', true, 'breed-qualified must still pass');
expect('meo ragdoll', 'mèo ragdoll', true, 'breed-qualified must still pass');
expect('gau meo', 'gấu mèo', true, 'breed name that collides with a species');
expect('lon dat', 'lợn đất', true, 'exotic');
expect('ca koi', 'cá koi', true, 'breed-qualified');
expect('chuot lang', 'chuột lang', true, 'exotic multi-word');

console.log('\n2. People must be rejected');
// This is the actual bug being fixed: someone typed their own name.
expect('Nguyen', 'Nguyễn', false, 'family name alone');
expect('Nguyen Van A', 'Nguyễn Văn A', false, 'full Vietnamese name');
expect('Nguyen Van An', 'Nguyễn Văn An', false, 'full name');
expect('Tran Thi Binh', 'Trần Thị Bình', false, 'full name');
expect('Le Minh Chau', 'Lê Minh Châu', false, 'full name');
expect('Phan Thi Tu', 'Phan Thị Tứ', false, 'staff name');
expect('Ta Trung Nguyen', 'Tạ Trung Nguyên', false, 'staff name');
expect('Dinh Phan Huu Khang', 'Đinh Phan Hữu Khang', false, 'staff name');
expect('anh Nguyen', 'Anh Nguyễn', false, 'honorific + name');
expect('chi Lan', 'chị Lan', false, 'honorific + given name');
expect('Minh', 'Minh', false, 'given name');
expect('Huong', 'Hương', false, 'given name');
expect('Quynh', 'Quỳnh', false, 'given name');
expect('BS Lan', 'BS Lan', false, 'title + name');
expect('Nguyen Lan Huong', 'Nguyễn Lan Hương', false, 'three-part name');

console.log('\n3. Sentences and junk must be rejected');
expect('empty', '', false, 'empty is never a species');
expect('whitespace', '   ', false, 'whitespace only');
expect('single char', 'a', false, 'too short to be a species');
expect(
  'long sentence',
  'tôi nuôi con mèo bị bệnh từ hồi tháng ba',
  false,
  'a description'
);
expect('ownership phrase', 'con của tôi', false, 'possessive phrase');
expect('very long', 'a'.repeat(61), false, 'past the length cap');

console.log('\n4. Numbers and symbols must be rejected');
expect('phone number', '0901234567', false, 'digits are never a species');
expect('mixed junk', '@#$%^&*', false, 'symbols only');

console.log('\n5. Unknown-but-plausible species must be ACCEPTED');
// The deliberate default: an animal the dictionary has never heard of should
// reach the vet, not be blocked. Rejecting here would break a real customer.
expect('guinea pig', 'guinea pig', true, 'known animal, alt wording');
expect('chinchilla', 'chinchilla', true, 'known animal');
expect('ferret', 'ferret', true, 'known animal');
expect('ky lan', 'kỳ lân', true, 'unusual but a real Vietnamese pet word');
expect('lac da', 'lạc đà', true, 'large animal');
expect('ho', 'hổ', true, 'unusual in a clinic, still an animal');

console.log('\n6. The suggestion list is itself valid');
let suggestionFailures = 0;
for (const suggestion of SPECIES_SUGGESTIONS) {
  const verdict = validatePetSpecies(suggestion);
  if (!verdict.ok) {
    suggestionFailures += 1;
    console.log(`  x suggestion "${suggestion}" would be rejected (${verdict.reason})`);
  }
}
if (suggestionFailures === 0) {
  passed += SPECIES_SUGGESTIONS.length;
  console.log(`  + all ${SPECIES_SUGGESTIONS.length} suggestions validate`);
} else {
  failed += suggestionFailures;
}

console.log(`\npet-species: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);