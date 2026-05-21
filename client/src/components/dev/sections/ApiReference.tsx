import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevEndpointTable from '../DevEndpointTable';

/**
 * Complete catalog of HTTP endpoints exposed by mirror-server and dina-server.
 * Grouped by domain. The "Path" column gives the path relative to the
 * service's mount; the implied base is /mirror/api for mirror-server and
 * /dina/api/v1 for dina-server (the dina table calls this out explicitly).
 */
const ApiReference: React.FC = () => {
  return (
    <DevSection id="api-reference" title="API reference" eyebrow="Reference">
      <DevSubsection id="api-reference-auth" title="Authentication">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/auth"
          rows={[
            { method: 'POST', path: '/register',                description: 'Register a new account.',              access: 'Public' },
            { method: 'POST', path: '/login',                   description: 'Email + password sign-in.',            access: 'Public' },
            { method: 'GET',  path: '/verify',                  description: 'Hydrate user from JWT.',               access: 'JWT' },
            { method: 'POST', path: '/refresh',                 description: 'Issue a new access token.',            access: 'JWT (refresh)' },
            { method: 'POST', path: '/logout',                  description: 'Revoke current session.',              access: 'JWT' },
            { method: 'POST', path: '/logout-all',              description: 'Revoke every session for the user.',   access: 'JWT' },
            { method: 'POST', path: '/send-verification',       description: 'Trigger a verification email.',         access: 'JWT', notes: 'Rate limited' },
            { method: 'POST', path: '/verify-email',            description: 'Consume an email-verification token.', access: 'Token' },
            { method: 'GET',  path: '/verification-status',     description: 'Is the current user verified?',        access: 'JWT' },
            { method: 'POST', path: '/forgot-password',         description: 'Request a reset email.',                access: 'Public', notes: 'Rate limited; generic response' },
            { method: 'GET',  path: '/reset-password/validate', description: 'Validate a reset token (no consume).',  access: 'Token' },
            { method: 'POST', path: '/reset-password',          description: 'Apply a new password and consume the token.', access: 'Token' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-user" title="User & account">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/user"
          rows={[
            { method: 'GET',    path: '/search',          description: 'Search other users.',                      access: 'JWT + sub' },
            { method: 'GET',    path: '/export',          description: 'GDPR data export ZIP.',                    access: 'JWT' },
            { method: 'POST',   path: '/update-password', description: 'Change password (server-side wired).',     access: 'JWT' },
            { method: 'POST',   path: '/update-email',    description: 'Change email (re-verification triggered).',access: 'JWT' },
            { method: 'POST',   path: '/delete',          description: 'Delete account; cascades all user data.',  access: 'JWT' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-intake" title="Intake">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/intake"
          rows={[
            { method: 'POST', path: '/store',                            description: 'Store an intake assessment.',  access: 'JWT' },
            { method: 'GET',  path: '/retrieve/:userId/:intakeId',       description: 'Retrieve a specific intake.', access: 'JWT' },
            { method: 'GET',  path: '/list/:userId',                     description: 'List a user\'s intakes.',     access: 'JWT' },
            { method: 'GET',  path: '/latest/:userId',                   description: 'Latest intake (hot path).',   access: 'JWT', notes: 'Used by IntakeGate' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-journal" title="Journal">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/journal"
          rows={[
            { method: 'POST', path: '/entry',                      description: 'Create a journal entry.',           access: 'JWT', notes: '10/5min; usage gated' },
            { method: 'GET',  path: '/entry/date/:date',           description: 'Entry by date (YYYY-MM-DD).',        access: 'JWT' },
            { method: 'GET',  path: '/entries',                    description: 'List with pagination.',              access: 'JWT' },
            { method: 'GET',  path: '/search',                     description: 'Full-text search.',                  access: 'JWT' },
            { method: 'GET',  path: '/analytics/mood-trend',       description: 'Mood analytics over time.',          access: 'Premium' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-groups" title="Groups">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/groups"
          rows={[
            { method: 'POST',   path: '/create',                                 description: 'Create a new group.',                  access: 'Premium' },
            { method: 'GET',    path: '/',                                       description: 'List user\'s groups.',                 access: 'JWT' },
            { method: 'GET',    path: '/:groupId',                               description: 'Group details.',                       access: 'JWT' },
            { method: 'PUT',    path: '/:groupId',                               description: 'Update group settings.',               access: 'Admin' },
            { method: 'DELETE', path: '/:groupId',                               description: 'Delete a group (cascade).',            access: 'Owner' },
            { method: 'POST',   path: '/join',                                   description: 'Join a private group.',                access: 'JWT', notes: '5/month free' },
            { method: 'POST',   path: '/:groupId/join',                          description: 'Accept an invite to a group.',         access: 'JWT' },
            { method: 'POST',   path: '/:groupId/leave',                         description: 'Leave a group.',                        access: 'JWT' },
            { method: 'POST',   path: '/:groupId/invite',                        description: 'Issue an invite token.',                access: 'Admin' },
            { method: 'GET',    path: '/:groupId/members',                       description: 'List members.',                         access: 'JWT' },
            { method: 'DELETE', path: '/:groupId/members/:userId',               description: 'Remove a member.',                      access: 'Admin' },
            { method: 'POST',   path: '/:groupId/request-join',                  description: 'Request to join a public group.',       access: 'JWT' },
            { method: 'GET',    path: '/:groupId/join-requests',                 description: 'List pending requests.',                access: 'Admin' },
            { method: 'POST',   path: '/:groupId/join-requests/:requestId/approve', description: 'Approve a join request.',           access: 'Admin' },
            { method: 'POST',   path: '/:groupId/join-requests/:requestId/reject',  description: 'Reject a join request.',            access: 'Admin' },
            { method: 'GET',    path: '/directory',                              description: 'Search public groups.',                 access: 'JWT' },
            { method: 'POST',   path: '/:groupId/generate-insights',             description: 'Trigger a group analysis.',             access: 'Premium' },
            { method: 'GET',    path: '/:groupId/insights',                      description: 'Latest insights.',                      access: 'JWT' },
            { method: 'GET',    path: '/:groupId/insights/history',              description: 'Historical insights.',                  access: 'JWT' },
            { method: 'GET',    path: '/:groupId/compatibility',                 description: 'Compatibility matrix.',                 access: 'JWT' },
            { method: 'GET',    path: '/:groupId/strengths',                     description: 'Collective strengths.',                 access: 'JWT' },
            { method: 'GET',    path: '/:groupId/conflicts',                     description: 'Conflict risk assessment.',             access: 'JWT' },
            { method: 'POST',   path: '/:groupId/votes/create',                  description: 'Propose a vote.',                       access: 'JWT' },
            { method: 'GET',    path: '/:groupId/votes/:voteId',                 description: 'Vote details.',                         access: 'JWT' },
            { method: 'POST',   path: '/:groupId/votes/:voteId/vote',            description: 'Cast a vote.',                          access: 'JWT' },
            { method: 'POST',   path: '/:groupId/votes/:voteId/close',           description: 'Close a vote early.',                   access: 'Admin' },
            { method: 'GET',    path: '/:groupId/sessions/:sessionId',           description: 'Session analysis.',                     access: 'JWT' },
            { method: 'POST',   path: '/:groupId/sessions/:sessionId/generate',  description: 'Trigger session analysis.',             access: 'JWT' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-chat" title="Group chat">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/groups/:groupId/chat"
          rows={[
            { method: 'POST',   path: '/messages',                              description: 'Send a message (encrypted).',   access: 'JWT' },
            { method: 'GET',    path: '/messages',                              description: 'Cursor-paginated fetch.',       access: 'JWT', notes: 'Default 50, max 100' },
            { method: 'GET',    path: '/messages/:messageId',                   description: 'Fetch a single message.',        access: 'JWT' },
            { method: 'PUT',    path: '/messages/:messageId',                   description: 'Edit (sender only).',            access: 'JWT' },
            { method: 'DELETE', path: '/messages/:messageId',                   description: 'Delete (sender or admin).',      access: 'JWT' },
            { method: 'POST',   path: '/messages/:messageId/reactions',         description: 'Add emoji reaction.',            access: 'JWT' },
            { method: 'DELETE', path: '/messages/:messageId/reactions/:emoji',  description: 'Remove a reaction.',             access: 'JWT' },
            { method: 'POST',   path: '/typing',                                description: 'Send typing indicator.',          access: 'JWT' },
            { method: 'GET',    path: '/presence',                              description: 'Member presence map.',            access: 'JWT' },
            { method: 'POST',   path: '/read-receipts',                         description: 'Mark messages read.',             access: 'JWT' },
            { method: 'GET',    path: '/search',                                description: 'Full-text search in group.',      access: 'JWT' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-truthstream" title="TruthStream">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/truthstream"
          rows={[
            { method: 'POST',   path: '/profile',                              description: 'Create or upsert truth card profile.',   access: 'JWT + sub', notes: '10/5min' },
            { method: 'GET',    path: '/profile',                              description: 'Get own profile.',                       access: 'JWT', notes: '60/min' },
            { method: 'PUT',    path: '/profile',                              description: 'Update profile.',                        access: 'JWT + sub' },
            { method: 'GET',    path: '/truth-card/:profileId',                description: 'Public truth card for another user.',    access: 'JWT' },
            { method: 'POST',   path: '/queue',                                description: 'Start the review queue.',                 access: 'JWT' },
            { method: 'GET',    path: '/queue',                                 description: 'Next item to review.',                   access: 'JWT' },
            { method: 'POST',   path: '/queue/:itemId/start',                  description: 'Lock an item and start the timer.',      access: 'JWT' },
            { method: 'POST',   path: '/queue/:itemId/complete',               description: 'Submit review responses.',                access: 'JWT' },
            { method: 'GET',    path: '/reviews/received',                     description: 'Reviews about the current user (anonymous).', access: 'JWT' },
            { method: 'GET',    path: '/reviews/given',                        description: 'Reviews authored by the current user.',  access: 'JWT' },
            { method: 'POST',   path: '/reviews/:reviewId/helpful',            description: 'Mark a review helpful.',                  access: 'JWT' },
            { method: 'POST',   path: '/reviews/:reviewId/unhelpful',          description: 'Unmark helpful.',                         access: 'JWT' },
            { method: 'POST',   path: '/reviews/:reviewId/flag',               description: 'Flag a review (moderation).',             access: 'JWT' },
            { method: 'POST',   path: '/dialogue/:reviewId/message',           description: 'Post a dialogue message.',                access: 'JWT' },
            { method: 'GET',    path: '/dialogue/:reviewId',                   description: 'Fetch a dialogue thread.',                access: 'JWT' },
            { method: 'GET',    path: '/analysis/:profileId',                  description: 'Truth-mirror perception-gap report.',     access: 'JWT' },
            { method: 'POST',   path: '/analysis/:profileId/generate',         description: 'Trigger generation.',                     access: 'JWT' },
            { method: 'GET',    path: '/analysis/:profileId/trends',           description: 'Analysis trends over time.',              access: 'JWT' },
            { method: 'GET',    path: '/stats',                                description: 'Personal TruthStream stats.',             access: 'JWT' },
            { method: 'GET',    path: '/milestones',                           description: 'Unlocked achievements.',                  access: 'JWT' },
            { method: 'GET',    path: '/questionnaire/:goalCategory',          description: 'Questionnaire schema for a goal.',        access: 'JWT' },
            { method: 'POST',   path: '/feedback-request',                     description: 'Request specific feedback.',              access: 'JWT' },
            { method: 'GET',    path: '/feedback-requests/mine',               description: 'List own feedback requests.',             access: 'JWT' },
            { method: 'GET',    path: '/feedback-requests/feed',               description: 'Feed of feedback requests to respond to.',access: 'JWT' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-mymirror" title="MyMirror / Personal analysis">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/personal-analysis"
          rows={[
            { method: 'POST', path: '/generate', description: 'Generate the personal report.', access: 'JWT', notes: '1/week free' },
            { method: 'GET',  path: '/',        description: 'Latest personal analysis.',     access: 'JWT' },
            { method: 'GET',  path: '/history', description: 'Past analyses.',                 access: 'JWT' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-subscription" title="Subscription">
        <DevEndpointTable
          caption="mirror-server — /mirror/api/subscription"
          rows={[
            { method: 'GET',  path: '/',            description: 'Current subscription status.',                access: 'JWT' },
            { method: 'GET',  path: '/plans',       description: 'Available plans.',                            access: 'JWT' },
            { method: 'POST', path: '/create',      description: 'Initiate subscription; returns PayPal URL.',  access: 'JWT' },
            { method: 'POST', path: '/approve',     description: 'Finalize after PayPal redirect.',             access: 'JWT' },
            { method: 'POST', path: '/cancel',      description: 'Cancel; grace period applies.',               access: 'JWT' },
            { method: 'POST', path: '/reactivate',  description: 'Reactivate within grace period.',             access: 'JWT' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="api-reference-dina" title="Dina (v1)">
        <DevEndpointTable
          caption="dina-server — /dina/api/v1 (paths shown without the base)"
          rows={[
            { method: 'GET',  path: '/health',                                          description: 'Public liveness.',                                  access: 'Public' },
            { method: 'GET',  path: '/models',                                          description: 'Available LLM models (filtered by trust level).',   access: 'JWT or Service' },
            { method: 'POST', path: '/models/:modelId/chat',                            description: 'Chat completion.',                                   access: 'JWT or Service' },
            { method: 'POST', path: '/models/:modelId/embed',                           description: 'Embeddings.',                                        access: 'JWT or Service' },
            { method: 'GET',  path: '/mirror/status',                                   description: 'Mirror module status.',                              access: 'Service' },
            { method: 'POST', path: '/mirror/submit',                                   description: 'Process Mirror intake submission.',                  access: 'Service' },
            { method: 'POST', path: '/mirror/synthesize-insights',                      description: 'Group / conversation / post-session synthesis.',     access: 'Service', notes: '300s timeout' },
            { method: 'POST', path: '/mirror/truthstream/classify-review',              description: 'Review classification.',                              access: 'Service', notes: '300s timeout' },
            { method: 'POST', path: '/mirror/truthstream/generate-analysis',            description: 'Truth Mirror Report.',                                access: 'Service', notes: '300s timeout' },
            { method: 'POST', path: '/mirror/truthstream/validate-truth-card',          description: 'Card validation (non-LLM).',                          access: 'Service' },
            { method: 'POST', path: '/mirror/truthstream/score-review-quality',         description: 'Quality score.',                                       access: 'Service' },
            { method: 'POST', path: '/mirror/truthstream/assess-hostility-pattern',     description: 'Hostility assessment.',                                access: 'Service' },
            { method: 'POST', path: '/mirror/personal-analysis/generate',               description: 'Personal report.',                                     access: 'Service', notes: '300s timeout' },
            { method: 'GET',  path: '/mirror/truthstream/health',                       description: 'TruthStream sub-module liveness.',                     access: 'Public' },
            { method: 'GET',  path: '/digim/status',                                    description: 'DIGIM health.',                                        access: 'Trusted' },
            { method: 'POST', path: '/digim/query',                                     description: 'Natural-language intelligence query.',                 access: 'Trusted' },
            { method: 'GET',  path: '/admin/auth/stats',                                description: 'Authentication statistics.',                            access: 'Admin' },
            { method: 'POST', path: '/admin/users/:dina_key/block',                     description: 'Block a Dina user.',                                   access: 'Admin' },
          ]}
        />
      </DevSubsection>
    </DevSection>
  );
};

export default ApiReference;
