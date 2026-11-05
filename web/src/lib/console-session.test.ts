/**
 * Tower's session, in the shape the shared shell renders.
 *
 * A tower session is signed in to exactly one org, so the shell's org list is
 * that org and nothing else, and it is the current one.
 */

import { describe, expect, it } from 'vitest';

import { toConsoleSession } from './console-session';
import type { SessionInfo } from './types';

const info: SessionInfo = {
  user: { id: 'u-1', email: 'ada@acme.test', name: 'Ada' },
  org: { id: 'o-1', slug: 'acme', name: 'Acme', plan: 'team' },
  role: 'admin',
  scopes: ['jobs:read'],
  platformUrl: 'https://savvagent.example'
};

describe('toConsoleSession', () => {
  it('makes the one org both the list and the current org, with the role', () => {
    const session = toConsoleSession(info);
    const org = { id: 'o-1', slug: 'acme', name: 'Acme', role: 'admin' };
    expect(session.orgs).toEqual([org]);
    expect(session.currentOrg).toEqual(org);
  });

  it('carries the user and the platform address through unchanged', () => {
    const session = toConsoleSession(info);
    expect(session.user).toEqual(info.user);
    expect(session.platformUrl).toBe('https://savvagent.example');
  });
});
