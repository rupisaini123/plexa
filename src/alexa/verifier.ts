import type { Verifier } from 'ask-sdk-express-adapter';
import { getAlexaSkillId } from '../services/settings.js';

export class ApplicationIdVerifier implements Verifier {
  async verify(textBody: string): Promise<void> {
    const expected = getAlexaSkillId();
    if (!expected) return;
    const body = JSON.parse(textBody) as {
      session?: { application?: { applicationId?: string } };
      context?: { System?: { application?: { applicationId?: string } } };
    };
    const appId =
      body.session?.application?.applicationId ??
      body.context?.System?.application?.applicationId;
    if (appId !== expected) {
      throw new Error('Invalid applicationId');
    }
  }
}
