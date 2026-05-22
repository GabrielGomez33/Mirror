import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevEndpointTable from '../DevEndpointTable';

const Websocket: React.FC = () => {
  return (
    <DevSection id="websocket" title="WebSocket events" eyebrow="Real-time">
      <DevSubsection id="websocket-endpoints" title="Endpoints">
        <DevEndpointTable
          hideAccess
          caption="WebSocket endpoints"
          rows={[
            { method: 'WS', path: 'wss://…/mirror/groups/ws',   description: 'mirror-server — group notifications: members, votes, analysis, conversation insights.' },
            { method: 'WS', path: 'wss://…/mirror/groups/chat', description: 'mirror-server — group chat: messages, reactions, typing, presence, @Dina streaming.' },
            { method: 'WS', path: 'wss://…/dina/ws',            description: 'dina-server — worker → Dina bridge. Carries DUMP envelopes for streaming requests.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="websocket-groups" title="Group notification events">
        <DevEndpointTable
          hideAccess
          hideNotes
          caption="Server → client events on /mirror/groups/ws"
          rows={[
            { method: 'WS', path: 'member:joined',          description: 'A new member joined a group the user is in.' },
            { method: 'WS', path: 'member:left',            description: 'A member left.' },
            { method: 'WS', path: 'member:updated',         description: 'Member role or shared_data_types changed.' },
            { method: 'WS', path: 'data:shared',            description: 'A member opted to share a new data type with the group.' },
            { method: 'WS', path: 'vote:proposed',          description: 'A new vote was proposed.' },
            { method: 'WS', path: 'vote:cast',              description: 'A vote was cast.' },
            { method: 'WS', path: 'vote:completed',         description: 'A vote completed (closed or expired).' },
            { method: 'WS', path: 'analysis:started',       description: 'A group analysis job started.' },
            { method: 'WS', path: 'analysis:completed',     description: 'A group analysis finished; insights are ready.' },
            { method: 'WS', path: 'conversation:insight',   description: 'A periodic conversation insight was generated.' },
            { method: 'WS', path: 'insights:updated',       description: 'Group insights snapshot updated.' },
          ]}
        />
        <DevEndpointTable
          hideAccess
          hideNotes
          caption="Client → server events on /mirror/groups/ws"
          rows={[
            { method: 'WS', path: 'subscribe',  description: 'Subscribe to events for a specific groupId.' },
            { method: 'WS', path: 'unsubscribe',description: 'Stop receiving events for a groupId.' },
            { method: 'WS', path: 'visibility', description: 'Phase 6a.5 — report page visibility so push delivery can skip foregrounded users.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="websocket-chat" title="Chat events">
        <DevEndpointTable
          hideAccess
          hideNotes
          caption="Events on /mirror/groups/chat"
          rows={[
            { method: 'WS', path: 'new_message',       description: 'A new chat message was sent.' },
            { method: 'WS', path: 'message_edited',    description: 'A message was edited (only by sender).' },
            { method: 'WS', path: 'message_deleted',   description: 'A message was deleted (soft or hard).' },
            { method: 'WS', path: 'reactions_updated', description: 'Reactions on a message changed.' },
            { method: 'WS', path: 'typing',            description: 'Typing indicator (5s TTL).' },
            { method: 'WS', path: 'presence_updated',  description: 'A member changed online/away/offline.' },
            { method: 'WS', path: 'mention',           description: 'The user was @-mentioned in a message.' },
            { method: 'WS', path: 'message_read',      description: 'A message was marked as read.' },
            { method: 'WS', path: 'dina_processing',   description: 'Dina is generating a response (followed by streaming dina_message events).' },
            { method: 'WS', path: 'dina_message',      description: 'A partial or final @Dina response chunk.' },
            { method: 'WS', path: 'dina_error',        description: 'Dina failed; the chat UI surfaces a contextual error.' },
          ]}
        />
        <DevCodeBlock
          language="json"
          caption="Wire-level message frame (chat)"
          code={`
{
  "type": "message",
  "groupId": "8d2c1a6a-…",
  "content": "<base64 AES-GCM ciphertext>",
  "contentType": "text",
  "metadata": { "iv": "…", "tag": "…" }
}
          `}
        />
      </DevSubsection>

      <DevSubsection id="websocket-signaling" title="WebRTC signaling">
        <DevEndpointTable
          hideAccess
          hideNotes
          caption="Signaling frames (relayed peer-to-peer)"
          rows={[
            { method: 'WS', path: 'offer',         description: 'SDP offer from initiator to a group peer.' },
            { method: 'WS', path: 'answer',        description: 'SDP answer back to initiator.' },
            { method: 'WS', path: 'ice-candidate', description: 'ICE candidate relay.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="websocket-lifecycle" title="Connection lifecycle">
        <ol className="dt-numbered space-y-1.5">
          <li>Client upgrades over WSS with the JWT in the query string.</li>
          <li>Server validates the token, records the user as online, registers the connection for heartbeat.</li>
          <li>Native ping every 30s. If a pong is not received within 10s, the connection is closed.</li>
          <li>On close, the user is removed from the online set and last_active is updated.</li>
          <li>The client (groupsWebSocket.ts) auto-reconnects with exponential backoff and jitter (max 50 attempts) and replays the in-memory message queue.</li>
        </ol>
      </DevSubsection>
    </DevSection>
  );
};

export default Websocket;
