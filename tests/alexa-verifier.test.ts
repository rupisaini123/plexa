import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationIdVerifier } from '../src/alexa/verifier.js';
import { resetEnvForTests } from '../src/config/index.js';
import { closeDb } from '../src/db/index.js';

describe('ApplicationIdVerifier', () => {
  beforeEach(() => {
    closeDb();
    resetEnvForTests();
  });

  it('accepts matching application id', async () => {
    process.env.ALEXA_SKILL_ID = 'amzn1.ask.skill.test';
    resetEnvForTests();
    const verifier = new ApplicationIdVerifier();
    const body = JSON.stringify({
      session: { application: { applicationId: 'amzn1.ask.skill.test' } },
    });
    await expect(verifier.verify(body)).resolves.toBeUndefined();
  });

  it('rejects mismatched application id', async () => {
    process.env.ALEXA_SKILL_ID = 'amzn1.ask.skill.expected';
    resetEnvForTests();
    const verifier = new ApplicationIdVerifier();
    const body = JSON.stringify({
      context: { System: { application: { applicationId: 'amzn1.ask.skill.other' } } },
    });
    await expect(verifier.verify(body)).rejects.toThrow('Invalid applicationId');
  });

  it('allows any id when skill id not configured', async () => {
    delete process.env.ALEXA_SKILL_ID;
    resetEnvForTests();
    const verifier = new ApplicationIdVerifier();
    const body = JSON.stringify({
      session: { application: { applicationId: 'anything' } },
    });
    await expect(verifier.verify(body)).resolves.toBeUndefined();
  });
});
