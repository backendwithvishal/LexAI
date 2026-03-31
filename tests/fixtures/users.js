/**
 * Test fixtures — User data
 * Used across unit and integration tests.
 */

export const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'SecurePass@123',
    role: 'viewer',
    emailVerified: true,
    isActive: true,
};

export const adminUser = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'AdminPass@123',
    role: 'admin',
    emailVerified: true,
    isActive: true,
};

export const unverifiedUser = {
    name: 'Unverified User',
    email: 'unverified@example.com',
    password: 'SecurePass@123',
    role: 'viewer',
    emailVerified: false,
    isActive: true,
};

export const loginPayload = {
    email: validUser.email,
    password: validUser.password,
};

export const registerPayload = {
    name: 'New User',
    email: 'newuser@example.com',
    password: 'SecurePass@123',
};
