/**
 * Test fixtures — Contract data
 */

export const validContract = {
    title: 'Test NDA Agreement',
    type: 'NDA',
    content: 'This Non-Disclosure Agreement is entered into as of January 1, 2026, between Party A and Party B. Both parties agree to keep all shared information strictly confidential and not disclose it to any third party without prior written consent.',
    tags: ['nda', 'test'],
};

export const shortContract = {
    title: 'Too Short',
    type: 'NDA',
    content: 'Too short.',  // < 50 chars — should fail validation
};

export const contractTypes = ['NDA', 'Vendor', 'Employment', 'SaaS', 'Other'];
