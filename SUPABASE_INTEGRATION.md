# Supabase Integration Guide

This guide explains how to connect the ContextGuard agent with your dashboard using Supabase.

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │         │              │         │             │
│  Dashboard  │◄────────│   Supabase   │◄────────│    Agent    │
│     (UI)    │         │   Database   │         │             │
│             │         │              │         │             │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      │                        │                        │
      ▼                        ▼                        ▼
  Read Events            Store Events            Report Events
  Read Policies          Store Policies          Fetch Policies
  Write Policies         Real-time Sync          Update Status
```

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and service role key

### 2. Set Up Database Schema

Run the SQL schema in your Supabase SQL editor:

```bash
# The schema is in agent/supabase-schema.sql
```

This creates three main tables:
- `agent_policies` - Stores security policies configured from UI
- `security_events` - Stores all security events from agents
- `agent_status` - Tracks agent health and status

### 3. Configure Agent

Set environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
export AGENT_ID="my-agent-1"
```

Or create a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
AGENT_ID=my-agent-1
```

### 4. Start Agent

```bash
# With environment variables
contextguard --server "node server.js"

# The agent will automatically:
# 1. Fetch policy from Supabase
# 2. Report all events to Supabase
# 3. Update status to "online"
```

## Data Flow

### Policy Configuration (UI → Agent)

1. **User configures policy in dashboard**
   ```typescript
   // Dashboard creates/updates policy
   const policy = {
     maxToolCallsPerMinute: 30,
     enablePromptInjectionDetection: true,
     enableSensitiveDataDetection: true,
     allowedFilePaths: ["/home/user/projects"],
     blockedPatterns: ["rm -rf", "DROP TABLE"]
   };
   
   await supabase
     .from('agent_policies')
     .upsert({
       agent_id: 'my-agent-1',
       policy: policy
     });
   ```

2. **Agent fetches policy on startup**
   - Agent reads from `agent_policies` table
   - Merges with local configuration
   - Applies the policy to all requests

### Event Reporting (Agent → UI)

1. **Agent reports events automatically**
   - Every security event is logged locally
   - Simultaneously sent to Supabase
   - Non-blocking (won't slow down agent)

2. **Dashboard reads events in real-time**
   ```typescript
   // Subscribe to new events
   const subscription = supabase
     .from('security_events')
     .on('INSERT', payload => {
       console.log('New event:', payload.new);
       // Update UI with new event
     })
     .subscribe();
   ```

## Dashboard Integration

### Example: Fetch Recent Events

```typescript
// app/api/events/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('security_events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ events: data });
}
```

### Example: Update Policy

```typescript
// app/api/policy/route.ts
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { agentId, policy } = await request.json();

  const { data, error } = await supabase
    .from('agent_policies')
    .upsert({
      agent_id: agentId,
      policy: policy,
      updated_at: new Date().toISOString()
    })
    .select();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data });
}
```

### Example: Real-time Event Stream

```typescript
// app/dashboard/events/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function EventsPage() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch initial events
    supabase
      .from('security_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)
      .then(({ data }) => setEvents(data || []));

    // Subscribe to new events
    const subscription = supabase
      .channel('security_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_events'
        },
        (payload) => {
          setEvents(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1>Security Events</h1>
      {events.map(event => (
        <div key={event.id}>
          <span>{event.event_type}</span>
          <span>{event.severity}</span>
          <span>{event.timestamp}</span>
        </div>
      ))}
    </div>
  );
}
```

## Event Types

The agent reports these event types:

- `TOOL_CALL` - Every tool invocation
- `SECURITY_VIOLATION` - Security policy violations
- `RATE_LIMIT_EXCEEDED` - Rate limit breaches
- `SENSITIVE_DATA_LEAK` - Sensitive data detected in responses
- `SERVER_START` - Agent started
- `SERVER_EXIT` - Agent stopped
- `SERVER_ERROR` - Agent errors
- `PARSE_ERROR` - Message parsing errors

## Security Considerations

1. **Use Service Role Key for Agent**
   - Agent needs write access to `security_events`
   - Agent needs read access to `agent_policies`

2. **Use Anon Key for Dashboard**
   - Dashboard users should use anon key
   - RLS policies control access

3. **Row Level Security (RLS)**
   - Already configured in schema
   - Authenticated users can read all data
   - Service role can write all data

## Troubleshooting

### Agent not reporting events

1. Check environment variables are set
2. Verify Supabase URL and key are correct
3. Check agent logs for errors
4. Verify network connectivity

### Dashboard not receiving events

1. Check Supabase anon key is correct
2. Verify RLS policies are enabled
3. Check browser console for errors
4. Test API endpoints directly

### Policy not loading

1. Verify `agent_id` matches in database
2. Check `agent_policies` table has data
3. Review agent startup logs

## Performance

- Events are reported asynchronously (non-blocking)
- Failed reports don't crash the agent
- Local logging continues even if Supabase is down
- Real-time subscriptions use minimal bandwidth

## Next Steps

1. Set up Supabase project
2. Run database schema
3. Configure agent environment variables
4. Build dashboard UI components
5. Test end-to-end flow
