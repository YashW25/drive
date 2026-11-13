import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanPhoneNumber,
  formatPhoneDisplay,
  parseGoogleContactsCSV,
  parseVCard,
  parsePastedContacts,
  deserializeRuleNumbers,
  serializeRuleContacts,
} from './googleContactsParser.ts';

test('cleanPhoneNumber handles 10-digit numbers with default country code', () => {
  assert.equal(cleanPhoneNumber('9373395000', '91'), '919373395000');
  assert.equal(cleanPhoneNumber('09373395000', '91'), '919373395000');
  assert.equal(cleanPhoneNumber('+91 93733 95000', '91'), '919373395000');
  assert.equal(cleanPhoneNumber('+1 (555) 123-4567'), '15551234567');
});

test('formatPhoneDisplay formats phone numbers nicely', () => {
  assert.equal(formatPhoneDisplay('919373395000'), '+91 93733 95000');
  assert.equal(formatPhoneDisplay('15551234567'), '+1 (555) 123-4567');
  assert.equal(formatPhoneDisplay('447911123456'), '+44 7911 123456');
});

test('parseGoogleContactsCSV parses standard Google Contacts CSV correctly', () => {
  const sampleCSV = `Name,Given Name,Additional Name,Family Name,Phone 1 - Type,Phone 1 - Value,Phone 2 - Type,Phone 2 - Value
"Yash Warulkar",Yash,,Warulkar,Mobile,+91 93733 95000,Work,07588688707
"Innovara Dynamics",,,,Main,+91 919359937655,,
"John Doe",John,,Doe,Cell,9876543210,,`;

  const contacts = parseGoogleContactsCSV(sampleCSV, '91');
  assert.equal(contacts.length, 4);

  assert.equal(contacts[0].name, 'Yash Warulkar');
  assert.equal(contacts[0].phone, '919373395000');
  assert.equal(contacts[0].formattedPhone, '+91 93733 95000');

  assert.equal(contacts[1].name, 'Yash Warulkar');
  assert.equal(contacts[1].phone, '917588688707');

  assert.equal(contacts[2].name, 'Innovara Dynamics');
  assert.equal(contacts[2].phone, '919359937655');

  assert.equal(contacts[3].name, 'John Doe');
  assert.equal(contacts[3].phone, '919876543210');
});

test('parseVCard parses standard vCard files correctly', () => {
  const sampleVcf = `BEGIN:VCARD
VERSION:3.0
FN:Yash Warulkar
N:Warulkar;Yash;;;
TEL;TYPE=CELL:+91 93733 95000
TEL;TYPE=WORK:917588688707
END:VCARD
BEGIN:VCARD
VERSION:2.1
FN:Support Team
TEL;VOICE:+91 919359937655
END:VCARD`;

  const contacts = parseVCard(sampleVcf, '91');
  assert.equal(contacts.length, 3);
  assert.equal(contacts[0].name, 'Yash Warulkar');
  assert.equal(contacts[0].phone, '919373395000');
  assert.equal(contacts[1].name, 'Yash Warulkar');
  assert.equal(contacts[1].phone, '917588688707');
  assert.equal(contacts[2].name, 'Support Team');
  assert.equal(contacts[2].phone, '919359937655');
});

test('parsePastedContacts parses multiple formats correctly', () => {
  const pasted = `919373395000
Yash: +91 75886 88707
919359937655 (Support)
918888888888, 919999999999`;

  const contacts = parsePastedContacts(pasted, '91');
  assert.equal(contacts.length, 5);
  assert.equal(contacts[0].phone, '919373395000');
  assert.equal(contacts[1].name, 'Yash');
  assert.equal(contacts[1].phone, '917588688707');
  assert.equal(contacts[2].name, 'Support');
  assert.equal(contacts[2].phone, '919359937655');
  assert.equal(contacts[3].phone, '918888888888');
  assert.equal(contacts[4].phone, '919999999999');
});

test('deserializeRuleNumbers and serializeRuleContacts round-trip smoothly', () => {
  const rawList = ['919373395000 (Yash Warulkar)', '917588688707', '919359937655 (Office)'];
  const deserialized = deserializeRuleNumbers(rawList);

  assert.equal(deserialized.length, 3);
  assert.equal(deserialized[0].name, 'Yash Warulkar');
  assert.equal(deserialized[0].phone, '919373395000');
  assert.equal(deserialized[1].name, '');
  assert.equal(deserialized[1].phone, '917588688707');
  assert.equal(deserialized[2].name, 'Office');
  assert.equal(deserialized[2].phone, '919359937655');

  const serialized = serializeRuleContacts(deserialized);
  assert.deepEqual(serialized, rawList);
});
