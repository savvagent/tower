/**
 * Tower's session in the shape the shared shell renders (`ConsoleSession`).
 *
 * A tower session is signed in to exactly one org — the platform's token is
 * bound to it — so that org is the whole list and the current one. Other orgs
 * are reached through the shell's "all organizations" link to the platform.
 */

import type { ConsoleSession } from '@savvagent/console-ui';

import type { SessionInfo } from './types';

export function toConsoleSession(s: SessionInfo): ConsoleSession {
  const org = { id: s.org.id, slug: s.org.slug, name: s.org.name, role: s.role };
  return { user: s.user, orgs: [org], currentOrg: org, platformUrl: s.platformUrl };
}
