import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const Deployment: React.FC = () => {
  return (
    <DevSection id="deployment" title="Deployment & operations" eyebrow="Run book">
      <DevSubsection id="deployment-pm2" title="PM2 process model">
        <p>
          Both servers run under PM2 with their own <code>ecosystem.config.js</code>.
          Mirror's config defines five processes: the main API + four
          background workers. Dina's config defines one process for the
          Dina API.
        </p>
        <DevFieldList
          caption="mirror-server PM2 processes"
          rows={[
            { name: 'mirror-server',             description: 'Main Express + WSS. Memory limit 512 MB. Kill timeout 10s. Restart delay 3s. Max 15 restarts in 1h.' },
            { name: 'analysis-worker',           description: 'Runs AnalysisQueueProcessor. 384 MB. Kill timeout 15s.' },
            { name: 'dina-chat-worker',          description: 'Runs DinaChatQueueProcessor. 384 MB. 15s.' },
            { name: 'truthstream-worker',        description: 'Runs TruthStreamQueueProcessor. 384 MB. 15s. Optional health probe on :7777 when standalone.' },
            { name: 'personal-analysis-worker',  description: 'Runs PersonalAnalysisQueueProcessor. 384 MB. 15s.' },
          ]}
        />
        <DevCodeBlock
          language="bash"
          caption="Operational commands"
          code={`
npm run build                        # tsc
pm2 start ecosystem.config.js        # cold start everything
pm2 reload ecosystem.config.js       # zero-downtime — graceful per-process
pm2 restart ecosystem.config.js      # forceful, drops in-flight requests
pm2 stop ecosystem.config.js
pm2 logs                             # tail combined
pm2 monit                            # interactive CPU / mem dashboard
pm2 status
          `}
        />
      </DevSubsection>

      <DevSubsection id="deployment-env-mirror" title="Environment — mirror-server">
        <DevFieldList
          caption="Required"
          rows={[
            { name: 'TUGRRPRIV / TUGRRCERT / TUGRRINTERCERT', description: 'Paths to TLS private key, certificate, and intermediate chain.' },
            { name: 'MIRRORPORT',         description: 'HTTPS listen port (production: 8444).' },
            { name: 'MIRRORSTORAGE',      description: 'Directory for Multer file uploads.' },
            { name: 'JWT_KEY',            description: 'HS256 secret. Minimum 32 chars.' },
            { name: 'JWT_REFRESH_SECRET', description: 'Refresh-token secret. Minimum 32 chars.' },
            { name: 'SYSTEM_MASTER_KEY',  description: '256-bit hex (64 chars) — wraps per-group AES keys.' },
            { name: 'DB_HOST / DB_USER / DB_PASSWORD / DB_NAME', description: 'MySQL credentials.' },
            { name: 'REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB', description: 'Redis credentials.' },
          ]}
        />
        <DevFieldList
          caption="Optional but commonly set"
          rows={[
            { name: 'DB_POOL_SIZE',           description: 'Default 30.' },
            { name: 'EMAIL_PROVIDER + key',   description: 'resend or brevo + provider API key.' },
            { name: 'EMAIL_FROM',             description: 'noreply@theundergroundrailroad.world by default.' },
            { name: 'DINA_ENDPOINT',          description: 'HTTPS base for dina-server (mirror module routes).' },
            { name: 'DINA_WS_URL',            description: 'wss://…:8445/dina/ws.' },
            { name: 'MIRROR_SERVICE_KEY',     description: 'X-Service-Key for mirror-server → dina-server (bypasses trust ladder).' },
            { name: 'DEFAULT_MODEL',          description: 'Ollama model default. mistral:7b in production.' },
            { name: 'USE_DINA_STUB',          description: 'true to short-circuit the connector for local dev.' },
            { name: 'AI_CHECKIN_INTERVAL_MS', description: 'Periodic group analysis (default 30 min).' },
            { name: 'VOTE_DURATION_SECONDS',  description: 'Default vote window (60s).' },
            { name: 'LOG_LEVEL',              description: 'debug / info / warn / error.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="deployment-env-dina" title="Environment — dina-server">
        <DevFieldList
          caption="Required"
          rows={[
            { name: 'TUGRRPRIV / TUGRRCERT / TUGRRINTERCERT', description: 'Same TLS bundle as mirror-server (same hostname).' },
            { name: 'DINA_PORT',                 description: 'HTTPS listen (8445).' },
            { name: 'DB_* (host/user/password/name)', description: 'Shared MySQL.' },
            { name: 'REDIS_URL',                 description: 'Full Redis URI.' },
            { name: 'OLLAMA_BASE_URL',           description: 'http://localhost:11434 in single-host deploy.' },
            { name: 'DINA_DATA_DIR',             description: 'Disk path for persistence (embeddings, complexity, queries).' },
          ]}
        />
        <DevFieldList
          caption="Optional"
          rows={[
            { name: 'MIRROR_SERVICE_KEY',  description: 'Inbound service-key check from mirror-server.' },
            { name: 'PERSISTENCE_*',       description: 'Backup interval, max file size, compression level, complexity / query TTLs.' },
            { name: 'DEBUG',               description: 'dina:* namespaces.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="deployment-tls" title="TLS / certificates">
        <p>
          Both services load TLS materials at boot. The reverse proxy in
          front (Apache / nginx) terminates the public TLS for the SPA but
          mirror-server still listens TLS-direct on its private port. The
          intermediate chain (<code>TUGRRINTERCERT</code>) is required for
          mobile clients that do not bundle the issuer's root.
        </p>
      </DevSubsection>

      <DevSubsection id="deployment-logs" title="Logs & monitoring">
        <DevCodeBlock
          language="text"
          caption="Log file layout (/root/.pm2/logs)"
          code={`
mirror-server-{out,error,combined}.log
analysis-worker-{out,error}.log
dina-chat-worker-{out,error}.log
truthstream-worker-{out,error}.log
personal-analysis-worker-{out,error}.log
dina-server-{out,error,combined}.log
          `}
        />
        <p>
          In production each line is one JSON object —{' '}
          <code>{`{ timestamp, level, context, message, metadata }`}</code>. In
          dev, human-readable colored output. Dina additionally writes a
          structured audit row to <code>dina_system_logs</code> for warn
          and above.
        </p>
      </DevSubsection>

      <DevSubsection id="deployment-health" title="Health checks">
        <DevFieldList
          rows={[
            { name: 'GET /mirror/api/health',                  description: 'mirror-server liveness + version + feature flags.' },
            { name: 'GET /dina/api/v1/health',                 description: 'dina-server liveness.' },
            { name: 'GET /dina/api/v1/mirror/truthstream/health', description: 'Sub-module liveness for TruthStream paths.' },
            { name: 'Worker stdout',                            description: 'Each worker emits a stats line every 5–10 minutes (jobs processed, failures, retry count).' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="deployment-rollouts" title="Zero-downtime rollouts">
        <p>
          <code>pm2 reload</code> spawns the new process, waits for
          <code>listen_timeout</code>, and then SIGTERMs the old one with a
          10s kill-timeout. mirror-server registers a SIGTERM handler that
          drains in-flight HTTP, flushes Redis writes, and detaches WS
          listeners in reverse phase order before exiting. Long-lived WS
          clients reconnect automatically.
        </p>
        <DevCallout kind="tip">
          For schema migrations, run them <em>before</em> reload, and make
          them backward-compatible (additive). The two old + new processes
          briefly run side by side during reload, and any column the new
          code requires must already exist when the old code writes its
          last response.
        </DevCallout>
      </DevSubsection>
    </DevSection>
  );
};

export default Deployment;
