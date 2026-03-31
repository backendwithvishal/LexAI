import AppError from '../../../src/utils/AppError.js';

describe('AppError', () => {
    it('sets message, statusCode, and code', () => {
        const err = new AppError('Not found', 404, 'NOT_FOUND');
        expect(err.message).toBe('Not found');
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
    });

    it('defaults code to APP_ERROR', () => {
        const err = new AppError('Oops', 500);
        expect(err.code).toBe('APP_ERROR');
    });

    it('is an instance of Error', () => {
        const err = new AppError('Test', 400);
        expect(err).toBeInstanceOf(Error);
    });

    it('has name AppError', () => {
        const err = new AppError('Test', 400);
        expect(err.name).toBe('AppError');
    });

    it('has a stack trace', () => {
        const err = new AppError('Test', 400);
        expect(err.stack).toBeDefined();
    });
});
