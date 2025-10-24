# Security Refactoring Prompts

Generated: 10/24/2025, 10:48:07 PM

Total Files: 19
Total Issues: 63

---

## File: Users

**Path:** `/home/yousef/dev/E-commerce/services/Users`

**Issues:** 4

### Vulnerabilities

**[MISSING_HELMET]** - HIGH
- Description: App missing helmet middleware for security headers
- Location: Line N/A

**[MISSING_RATE_LIMITING]** - HIGH
- Description: App missing rate limiting middleware
- Location: Line N/A

**[MISSING_BODY_SIZE_LIMIT]** - MEDIUM
- Description: Body parser missing size limit (vulnerable to large payload attacks)
- Location: Line N/A

**[MISSING_AUTHENTICATION]** - HIGH
- Description: No authentication middleware detected
- Location: Line N/A

### Code Context

*This is a microservice-level issue. The vulnerability affects the entire service configuration.*

**Service Directory:** `/home/yousef/dev/E-commerce/services/Users`

Check the main entry point (e.g., app.js, index.js, main.ts) and configuration files.

### Required Fixes

- **MISSING_HELMET:** Add helmet middleware for security headers
- **MISSING_RATE_LIMITING:** Implement rate limiting to prevent abuse
- **MISSING_BODY_SIZE_LIMIT:** Add body size limits
- **MISSING_AUTHENTICATION:** Add JWT authentication middleware


---

## File: app.js

**Path:** `/home/yousef/dev/E-commerce/services/Users/src/app.js`

**Issues:** 5

### Vulnerabilities

**[PERMISSIVE_CORS]** - MEDIUM
- Description: CORS configured with overly permissive origin
- Location: Line 11

**[UNPROTECTED_ROUTE]** - HIGH
- Description: Sensitive route lacks authentication middleware
- Locations: line 98, line 131, line 168

**[INSECURE_HTTP]** - MEDIUM
- Description: HTTP connection instead of HTTPS
- Location: Line 14

### Code Context

**Lines 1-21:**

```
// services/Users/src/app.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import axios from 'axios';
import { connectDb, User } from './db.js';
import { initRMQ, rpcProvisionInAuth } from './rmq.js';

const app = express();
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const AUTH_URL = process.env.AUTH_URL || 'http://auth:3001';
const INTERNAL_CLIENT_ID = process.env.INTERNAL_CLIENT_ID || 'users-svc';

// ---------- helpers ----------
async function validateBearer(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
```

**Lines 4-24:**

```
import morgan from 'morgan';
import axios from 'axios';
import { connectDb, User } from './db.js';
import { initRMQ, rpcProvisionInAuth } from './rmq.js';

const app = express();
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const AUTH_URL = process.env.AUTH_URL || 'http://auth:3001';
const INTERNAL_CLIENT_ID = process.env.INTERNAL_CLIENT_ID || 'users-svc';

// ---------- helpers ----------
async function validateBearer(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;

  // Delegate token validation to Auth MS
  const { data } = await axios.get(`${AUTH_URL}/auth/validate`, {
```

**Lines 88-108:**

```
    });
  } catch (err) {
    console.error('[users] register error:', err?.response?.data || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- GET /users/me (by email or token) ----------
// Priority: Authorization Bearer (token) -> find by keycloakUserId
// Fallback: ?email=someone@example.com -> find by email
app.get('/users/me', async (req, res) => {
  try {
    let user = null;

    // Try token
    try {
      const v = await validateBearer(req);
      if (v?.sub) {
        user = await User.findOne({ keycloakUserId: String(v.sub) }).lean();
      }
    } catch {
```

**Lines 121-141:**

```
    const { _id, email, firstName, lastName, name, addresses } = user;
    res.json({ _id, email, firstName, lastName, name, addresses });
  } catch (err) {
    console.error('[users] /users/me error:', err?.response?.data || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- PATCH /users/me/edit (edit profile data) ----------
// Requires Authorization Bearer; updates local doc and mirrors first/last/email to Keycloak.
app.patch('/users/me/edit', async (req, res) => {
  try {
    const v = await validateBearer(req);
    if (!v?.sub) return res.status(401).json({ error: 'unauthorized' });

    const user = await User.findOne({ keycloakUserId: String(v.sub) });
    if (!user) return res.status(404).json({ error: 'not_found' });

    const allowed = ['firstName', 'lastName', 'name', 'addresses', 'email'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
```

**Lines 158-178:**

```
    const { _id, email, firstName, lastName, name, addresses } = user.toObject();
    res.json({ _id, email, firstName, lastName, name, addresses });
  } catch (err) {
    console.error('[users] /users/me/edit error:', err?.response?.data || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- GET /users/by-keycloak-id/:keycloakUserId (internal service-to-service) ----------
// Used by other microservices (e.g., Notifications) to fetch user details by keycloakUserId
app.get('/users/by-keycloak-id/:keycloakUserId', async (req, res) => {
  try {
    const { keycloakUserId } = req.params;
    
    if (!keycloakUserId) {
      return res.status(400).json({ error: 'missing_keycloak_user_id' });
    }

    const user = await User.findOne({ keycloakUserId: String(keycloakUserId) }).lean();
    
    if (!user) {
```

### Required Fixes

- **PERMISSIVE_CORS:** Restrict CORS to specific origins
- **UNPROTECTED_ROUTE:** Add authentication to route
- **INSECURE_HTTP:** Use HTTPS instead of HTTP


---

## File: Shipping

**Path:** `/home/yousef/dev/E-commerce/services/Shipping`

**Issues:** 4

### Vulnerabilities

**[MISSING_HELMET]** - HIGH
- Description: App missing helmet middleware for security headers
- Location: Line N/A

**[MISSING_RATE_LIMITING]** - HIGH
- Description: App missing rate limiting middleware
- Location: Line N/A

**[MISSING_BODY_SIZE_LIMIT]** - MEDIUM
- Description: Body parser missing size limit (vulnerable to large payload attacks)
- Location: Line N/A

**[MISSING_AUTHENTICATION]** - HIGH
- Description: No authentication middleware detected
- Location: Line N/A

### Code Context

*This is a microservice-level issue. The vulnerability affects the entire service configuration.*

**Service Directory:** `/home/yousef/dev/E-commerce/services/Shipping`

Check the main entry point (e.g., app.js, index.js, main.ts) and configuration files.

### Required Fixes

- **MISSING_HELMET:** Add helmet middleware for security headers
- **MISSING_RATE_LIMITING:** Implement rate limiting to prevent abuse
- **MISSING_BODY_SIZE_LIMIT:** Add body size limits
- **MISSING_AUTHENTICATION:** Add JWT authentication middleware


---

## File: shipping.js

**Path:** `/home/yousef/dev/E-commerce/services/Shipping/src/routes/shipping.js`

**Issues:** 1

### Vulnerabilities

**[UNPROTECTED_ROUTE]** - HIGH
- Description: Sensitive route lacks authentication middleware
- Location: Line 21

### Code Context

```
import express from 'express';
import axios from 'axios';
import Shipment from '../models/shipment.js';
import { env } from '../config.js';
import { getChannel } from '../broker.js';

const router = express.Router();

/**
 * POST /shipping/create
 *
 * Create a new shipment using the EasyPost API.  This endpoint accepts the
 * recipient and sender addresses and parcel information in the request body.
 * Vulnerabilities:
 *   – No authentication or authorisation; anyone can create shipments.
 *   – No input validation or sanitisation; malicious payloads could be sent
 *     directly to EasyPost or stored in the database.
 *   – The EasyPost API key is used without checking if it exists.  If
 *     undefined, axios will throw an error at runtime.
 */
router.post('/create', async (req, res) => {
  const { to, from, parcel } = req.body;
  try {
    // Construct the EasyPost shipment payload.  See official docs for details.
    const payload = {
      shipment: {
        to_address: to,
        from_address: from,
        parcel,
      },
    };
    // Call the EasyPost API.  Basic auth uses the API key as the username.
    const epRes = await axios.post('https://api.easypost.com/v2/shipments', payload, {
      auth: { username: env.easypostApiKey, password: '' },
    });
    const data = epRes.data;
    // Persist the shipment record locally.
    const shipment = await Shipment.create({
      userId: req.userId,
      epShipmentId: data.id,
      status: data.state,
    });
    // Publish an event to RabbitMQ for the new shipment. Anyone can consume
    // this event. There is no authentication on the broker connection.
    try {
      const channel = getChannel();
      if (channel) {
        const event = {
          event: 'shipping.created',
          data: {
            shipmentId: shipment._id,
            userId: shipment.userId,
            easyPostId: data.id,
            status: data.state,
          },
        };
        await channel.assertExchange('shipping.created', 'fanout', { durable: false });
        channel.publish('shipping.created', '', Buffer.from(JSON.stringify(event)));
      }
    } catch (pubErr) {
      console.error('[shipping-svc] failed to publish event:', pubErr);
    }
    res.json({ id: shipment._id, easyPostId: data.id, status: data.state });
  } catch (err) {
    console.error('[shipping-svc] error creating shipment:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
});

/**
 * GET /shipping/:id
 *
 * Retrieve a shipment from the database and fetch its latest status from
 * EasyPost.  Vulnerabilities:
 *   – No authorisation: any user can view any shipment.
 *   – Potential information disclosure if shipment IDs are guessable.
 */
router.get('/:id', async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    // Fetch latest status from EasyPost using the stored EasyPost shipment ID.
    const epRes = await axios.get(`https://api.easypost.com/v2/shipments/${shipment.epShipmentId}`, {
      auth: { username: env.easypostApiKey, password: '' },
    });
    shipment.status = epRes.data.state;
    await shipment.save();
    res.json(shipment);
  } catch (err) {
    console.error('[shipping-svc] error retrieving shipment:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch shipment' });
  }
});

export default router;
```

### Required Fixes

- **UNPROTECTED_ROUTE:** Add authentication to route


---

## File: Payment

**Path:** `/home/yousef/dev/E-commerce/services/Payment`

**Issues:** 4

### Vulnerabilities

**[MISSING_HELMET]** - HIGH
- Description: App missing helmet middleware for security headers
- Location: Line N/A

**[MISSING_RATE_LIMITING]** - HIGH
- Description: App missing rate limiting middleware
- Location: Line N/A

**[MISSING_BODY_SIZE_LIMIT]** - MEDIUM
- Description: Body parser missing size limit (vulnerable to large payload attacks)
- Location: Line N/A

**[MISSING_AUTHENTICATION]** - HIGH
- Description: No authentication middleware detected
- Location: Line N/A

### Code Context

*This is a microservice-level issue. The vulnerability affects the entire service configuration.*

**Service Directory:** `/home/yousef/dev/E-commerce/services/Payment`

Check the main entry point (e.g., app.js, index.js, main.ts) and configuration files.

### Required Fixes

- **MISSING_HELMET:** Add helmet middleware for security headers
- **MISSING_RATE_LIMITING:** Implement rate limiting to prevent abuse
- **MISSING_BODY_SIZE_LIMIT:** Add body size limits
- **MISSING_AUTHENTICATION:** Add JWT authentication middleware


---

## File: app.js

**Path:** `/home/yousef/dev/E-commerce/services/Payment/src/app.js`

**Issues:** 1

### Vulnerabilities

**[UNPROTECTED_ROUTE]** - HIGH
- Description: Sensitive route lacks authentication middleware
- Location: Line 11

### Code Context

```
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import paymentsRouter from './routes/payments.js';

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/payments', paymentsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

### Required Fixes

- **UNPROTECTED_ROUTE:** Add authentication to route


---

## File: Notifications

**Path:** `/home/yousef/dev/E-commerce/services/Notifications`

**Issues:** 4

### Vulnerabilities

**[MISSING_HELMET]** - HIGH
- Description: App missing helmet middleware for security headers
- Location: Line N/A

**[MISSING_RATE_LIMITING]** - HIGH
- Description: App missing rate limiting middleware
- Location: Line N/A

**[MISSING_BODY_SIZE_LIMIT]** - MEDIUM
- Description: Body parser missing size limit (vulnerable to large payload attacks)
- Location: Line N/A

**[MISSING_AUTHENTICATION]** - HIGH
- Description: No authentication middleware detected
- Location: Line N/A

### Code Context

*This is a microservice-level issue. The vulnerability affects the entire service configuration.*

**Service Directory:** `/home/yousef/dev/E-commerce/services/Notifications`

Check the main entry point (e.g., app.js, index.js, main.ts) and configuration files.

### Required Fixes

- **MISSING_HELMET:** Add helmet middleware for security headers
- **MISSING_RATE_LIMITING:** Implement rate limiting to prevent abuse
- **MISSING_BODY_SIZE_LIMIT:** Add body size limits
- **MISSING_AUTHENTICATION:** Add JWT authentication middleware


---

## File: notifications.js

**Path:** `/home/yousef/dev/E-commerce/services/Notifications/src/routes/notifications.js`

**Issues:** 2

### Vulnerabilities

**[EXPOSED_INTERNAL_ENDPOINT]** - HIGH
- Description: Potentially exposed internal/debug endpoint
- Location: Line 48

**[UNPROTECTED_ROUTE]** - HIGH
- Description: Sensitive route lacks authentication middleware
- Location: Line 48

### Code Context

```
import express from "express";
import { NotificationService } from "../services/notificationService.js";

const router = express.Router();
const notificationService = new NotificationService();

// Get notifications for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const notifications = await notificationService.getUserNotifications(userId, limit);

    res.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("[notifications-svc] Error fetching user notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  }
});

// Get notification statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await notificationService.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[notifications-svc] Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
});

// Manual notification trigger (for testing)
router.post("/test/payment", async (req, res) => {
  try {
    const { userId, paymentId, amount, currency } = req.body;

    if (!userId || !paymentId || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, paymentId, amount, currency",
      });
    }

    const notifications = await notificationService.processPaymentConfirmation({
      userId,
      paymentId,
      amount,
      currency,
    });

    res.json({
      success: true,
      message: "Test notifications sent",
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        channel: n.channel,
        status: n.status,
      })),
    });
  } catch (error) {
    console.error("[notifications-svc] Error sending test notification:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send test notification",
    });
  }
});

export default router;

```

### Required Fixes

- **EXPOSED_INTERNAL_ENDPOINT:** Protect or remove endpoint
- **UNPROTECTED_ROUTE:** Add authentication to route


---

## File: Auth

**Path:** `/home/yousef/dev/E-commerce/services/Auth`

**Issues:** 3

### Vulnerabilities

**[MISSING_HELMET]** - HIGH
- Description: App missing helmet middleware for security headers
- Location: Line N/A

**[MISSING_RATE_LIMITING]** - HIGH
- Description: App missing rate limiting middleware
- Location: Line N/A

**[MISSING_BODY_SIZE_LIMIT]** - MEDIUM
- Description: Body parser missing size limit (vulnerable to large payload attacks)
- Location: Line N/A

### Code Context

*This is a microservice-level issue. The vulnerability affects the entire service configuration.*

**Service Directory:** `/home/yousef/dev/E-commerce/services/Auth`

Check the main entry point (e.g., app.js, index.js, main.ts) and configuration files.

### Required Fixes

- **MISSING_HELMET:** Add helmet middleware for security headers
- **MISSING_RATE_LIMITING:** Implement rate limiting to prevent abuse
- **MISSING_BODY_SIZE_LIMIT:** Add body size limits


---

## File: app.js

**Path:** `/home/yousef/dev/E-commerce/services/Auth/src/app.js`

**Issues:** 1

### Vulnerabilities

**[PERMISSIVE_CORS]** - MEDIUM
- Description: CORS configured with overly permissive origin
- Location: Line 12

### Code Context

```
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';


import authRoutes from './routes/auth.routes.js';

const app = express();

app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());


app.use(authRoutes);

export default app;

```

### Required Fixes

- **PERMISSIVE_CORS:** Restrict CORS to specific origins


---

## File: auth.routes.js

**Path:** `/home/yousef/dev/E-commerce/services/Auth/src/routes/auth.routes.js`

**Issues:** 4

### Vulnerabilities

**[EXPOSED_INTERNAL_ENDPOINT]** - HIGH
- Description: Potentially exposed internal/debug endpoint
- Locations: line 20, line 112, line 145

**[HARDCODED_SECRET]** - HIGH
- Description: Hardcoded secret or credential detected
- Location: Line 138

### Code Context

**Lines 10-30:**

```

// --- health ---
r.get('/health', (_req, res) => res.json({ ok: true }));

// --- validate a token (user or client) ---
r.get('/auth/validate', verifyBearer, (req, res) => {
  res.json({ sub: req.auth.sub, email: req.auth.email, roles: req.auth.roles, payload: req.auth.payload });
});

// --- optional admin-only ping ---
r.get('/admin/ping', verifyBearer, requireRoles('ADMIN'), (_req, res) => res.json({ ok: true, requiredRole: 'ADMIN' }));

// --- LOGIN (password grant) ---
r.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields', fields: ['username', 'password'] });

  try {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: env.kc.clientId,
```

**Lines 102-122:**

```
    const logs = collection('access_logs');
    if (logs) logs.insertOne({ at: new Date(), action: 'logout' }).catch(() => {});

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'logout_failed', detail: e?.response?.data ?? String(e) });
  }
});

// --- INTERNAL: update a Keycloak user profile (Users MS) ---
r.patch('/internal/users/update', verifyBearer, requireClientIds(...env.internal.allowedClients), async (req, res) => {
  const { userId, firstName, lastName, email, emailVerified } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'missing_fields', fields: ['userId'] });

  try {
    const payload = {};
    if (firstName !== undefined) payload.firstName = firstName;
    if (lastName  !== undefined) payload.lastName  = lastName;
    if (email     !== undefined) payload.email     = email;
    if (emailVerified !== undefined) payload.emailVerified = !!emailVerified;

```

**Lines 128-148:**

```
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'update_failed', detail: e?.response?.data ?? String(e) });
  }
});

// --- SERVICE TOKEN (client_credentials) ---
r.post('/auth/client-token', async (_req, res) => {
  try {
    const access_token = await getServiceToken();
    res.json({ access_token, token_type: 'Bearer' });
  } catch (e) {
    res.status(400).json({ error: 'client_credentials_failed', detail: e?.response?.data ?? String(e) });
  }
});

// --- INTERNAL: provision a Keycloak user (Users MS) ---
r.post('/internal/users/provision', verifyBearer, requireClientIds(...env.internal.allowedClients), async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields', fields: ['username', 'password'] });

```

**Lines 135-155:**

```
r.post('/auth/client-token', async (_req, res) => {
  try {
    const access_token = await getServiceToken();
    res.json({ access_token, token_type: 'Bearer' });
  } catch (e) {
    res.status(400).json({ error: 'client_credentials_failed', detail: e?.response?.data ?? String(e) });
  }
});

// --- INTERNAL: provision a Keycloak user (Users MS) ---
r.post('/internal/users/provision', verifyBearer, requireClientIds(...env.internal.allowedClients), async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields', fields: ['username', 'password'] });

  try {
    const userId = await provisionUser(req.body);

    const logs = collection('access_logs');
    if (logs) logs.insertOne({ at: new Date(), action: 'provision', userId, username }).catch(() => {});

    res.status(201).json({ ok: true, userId });
```

### Required Fixes

- **EXPOSED_INTERNAL_ENDPOINT:** Protect or remove endpoint
- **HARDCODED_SECRET:** Move secrets to environment variables


---

## File: docker-compose.yml

**Path:** `/home/yousef/dev/E-commerce/docker-compose.yml`

**Issues:** 22

### Vulnerabilities

**[ROOT_CONTAINER]** - MEDIUM
- Description: Container runs as root user
- Locations: line 5, line 23, line 46, line 56, line 95, line 103, line 141, line 149, line 193, line 201, line 151, line 247

**[DEFAULT_CREDENTIALS]** - HIGH
- Description: Service uses default credentials
- Locations: line 68, line 112, line 160, line 210, line 160

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Locations: line 68, line 112, line 160, line 210, line 160

### Code Context

**Lines 1-15:**

```
version: "3.9"

services:

  rabbitmq:
    image: rabbitmq:3-management
    container_name: global-rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    networks:
      - ecommerce_net
```

**Lines 13-33:**

```
      RABBITMQ_DEFAULT_PASS: guest
    networks:
      - ecommerce_net
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  keycloak:
    image: quay.io/keycloak/keycloak:26.0
    container_name: keycloak
    command: 
      - start-dev
      - --import-realm
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    volumes:
      - ./services/Auth/keycloak-realm-export.json:/opt/keycloak/data/import/realm.json:ro
```

**Lines 36-56:**

```
    networks:
      - ecommerce_net
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 && echo -e 'GET /realms/e-commerce-testbed HTTP/1.1\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && timeout 2 cat <&3 | head -1 | grep -q '200'"]
      interval: 15s
      timeout: 10s
      retries: 20
      start_period: 90s

  auth:
    build: ./services/Auth
    container_name: auth-service
    ports:
      - "3001:3001"
    depends_on:
      keycloak:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      auth-mongo:
```

**Lines 46-66:**

```
  auth:
    build: ./services/Auth
    container_name: auth-service
    ports:
      - "3001:3001"
    depends_on:
      keycloak:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      auth-mongo:
        condition: service_healthy
    networks:
      - ecommerce_net
    environment:
      PORT: 3001
      KC_URL: http://keycloak:8080
      KC_REALM: e-commerce-testbed
      KC_CLIENT_ID: auth-admin
      KC_CLIENT_SECRET: ye68RY2jEtRgkF0kfRvlqKQEDA0t4mfw
      MONGO_URI: mongodb://ecomm_user:superStrongAppPwd@auth-mongo:27017/ecomm_auth?authSource=ecomm_auth
```

**Lines 58-78:**

```
    networks:
      - ecommerce_net
    environment:
      PORT: 3001
      KC_URL: http://keycloak:8080
      KC_REALM: e-commerce-testbed
      KC_CLIENT_ID: auth-admin
      KC_CLIENT_SECRET: ye68RY2jEtRgkF0kfRvlqKQEDA0t4mfw
      MONGO_URI: mongodb://ecomm_user:superStrongAppPwd@auth-mongo:27017/ecomm_auth?authSource=ecomm_auth
      MONGO_DB: ecomm_auth
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      INTERNAL_ALLOWED_CLIENTS: users-svc
    restart: unless-stopped

  auth-mongo:
    image: mongo:7
    container_name: auth-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME:-root}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD:-example}
```

**Lines 85-105:**

```
    networks:
      - ecommerce_net
    ports:
      - "27022:27017"
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 30s
      timeout: 10s
      retries: 5

  payment:
    build: ./services/Payment
    container_name: payment-service
    ports:
      - "3002:3002"
    depends_on:
      rabbitmq:
        condition: service_healthy
      payment-mongo:
        condition: service_healthy
    networks:
```

**Lines 93-113:**

```
      retries: 5

  payment:
    build: ./services/Payment
    container_name: payment-service
    ports:
      - "3002:3002"
    depends_on:
      rabbitmq:
        condition: service_healthy
      payment-mongo:
        condition: service_healthy
    networks:
      - ecommerce_net
    env_file:
      - ./services/Payment/.env
    environment:
      PORT: 3002
      MONGO_URI: mongodb://payment_user:payment_pass123@payment-mongo:27017/paymentdb
      RABBITMQ_URI: amqp://guest:guest@rabbitmq:5672
    restart: unless-stopped
```

**Lines 102-122:**

```
        condition: service_healthy
      payment-mongo:
        condition: service_healthy
    networks:
      - ecommerce_net
    env_file:
      - ./services/Payment/.env
    environment:
      PORT: 3002
      MONGO_URI: mongodb://payment_user:payment_pass123@payment-mongo:27017/paymentdb
      RABBITMQ_URI: amqp://guest:guest@rabbitmq:5672
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  payment-mongo:
    image: mongo:7
    container_name: payment-mongo
```

**Lines 131-151:**

```
    networks:
      - ecommerce_net
    ports:
      - "27018:27017"  # Different port to avoid conflicts with other MongoDB instances
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 30s
      timeout: 10s
      retries: 5

  notifications:
    build: ./services/Notifications
    container_name: notifications-service
    ports:
      - "3003:3003"
    depends_on:
      rabbitmq:
        condition: service_healthy
      notifications-mongo:
        condition: service_healthy
      users:
```

**Lines 139-159:**

```
      retries: 5

  notifications:
    build: ./services/Notifications
    container_name: notifications-service
    ports:
      - "3003:3003"
    depends_on:
      rabbitmq:
        condition: service_healthy
      notifications-mongo:
        condition: service_healthy
      users:
        condition: service_started
    networks:
      - ecommerce_net
    env_file:
      - ./services/Notifications/.env
    environment:
      PORT: 3003
      MONGO_URI: mongodb://notifications_user:notifications_pass123@notifications-mongo:27017/notificationsdb
```

**Lines 141-161:**

```
  notifications:
    build: ./services/Notifications
    container_name: notifications-service
    ports:
      - "3003:3003"
    depends_on:
      rabbitmq:
        condition: service_healthy
      notifications-mongo:
        condition: service_healthy
      users:
        condition: service_started
    networks:
      - ecommerce_net
    env_file:
      - ./services/Notifications/.env
    environment:
      PORT: 3003
      MONGO_URI: mongodb://notifications_user:notifications_pass123@notifications-mongo:27017/notificationsdb
      RABBITMQ_URI: amqp://guest:guest@rabbitmq:5672
      USERS_SERVICE_URL: http://users:4002
```

**Lines 150-170:**

```
        condition: service_healthy
      users:
        condition: service_started
    networks:
      - ecommerce_net
    env_file:
      - ./services/Notifications/.env
    environment:
      PORT: 3003
      MONGO_URI: mongodb://notifications_user:notifications_pass123@notifications-mongo:27017/notificationsdb
      RABBITMQ_URI: amqp://guest:guest@rabbitmq:5672
      USERS_SERVICE_URL: http://users:4002
      MAILERSEND_API_KEY: ${MAILERSEND_API_KEY:-}
      MAILERSEND_FROM_EMAIL: ${MAILERSEND_FROM_EMAIL:-noreply@yourdomain.com}
      MAILERSEND_FROM_NAME: ${MAILERSEND_FROM_NAME:-E-Commerce Platform}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Lines 183-203:**

```
    networks:
      - ecommerce_net
    ports:
      - "27019:27017"  # Different port to avoid conflicts
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 30s
      timeout: 10s
      retries: 5

  shipping:
    build: ./services/Shipping
    container_name: shipping-service
    ports:
      - "3004:3004"
    depends_on:
      rabbitmq:
        condition: service_healthy
      shipping-mongo:
        condition: service_healthy
    networks:
```

**Lines 191-211:**

```
      retries: 5

  shipping:
    build: ./services/Shipping
    container_name: shipping-service
    ports:
      - "3004:3004"
    depends_on:
      rabbitmq:
        condition: service_healthy
      shipping-mongo:
        condition: service_healthy
    networks:
      - ecommerce_net
    env_file:
      - ./services/Shipping/.env
    environment:
      PORT: 3004
      MONGO_URI: mongodb://shipping_user:shipping_pass123@shipping-mongo:27017/shippingdb
      RABBITMQ_URI: amqp://guest:guest@rabbitmq:5672
    restart: unless-stopped
```

**Lines 200-220:**

```
        condition: service_healthy
      shipping-mongo:
        condition: service_healthy
    networks:
      - ecommerce_net
    env_file:
      - ./services/Shipping/.env
    environment:
      PORT: 3004
      MONGO_URI: mongodb://shipping_user:shipping_pass123@shipping-mongo:27017/shippingdb
      RABBITMQ_URI: amqp://guest:guest@rabbitmq:5672
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3004/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  shipping-mongo:
    image: mongo:7
    container_name: shipping-mongo
```

**Lines 237-257:**

```
      retries: 5

  users:
    build: ./services/Users
    container_name: users-service
    ports:
      - "4002:4002"
    depends_on:
      rabbitmq:
        condition: service_healthy
      users-mongo:
        condition: service_healthy
      auth:
        condition: service_started
    networks:
      - ecommerce_net
    environment:
      PORT: 4002
      MONGO_URL: mongodb://ecomm_user:superStrongAppPwd@users-mongo:27017/ecomm_users?authSource=ecomm_users
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      INTERNAL_CLIENT_ID: users-svc
```

### Required Fixes

- **ROOT_CONTAINER:** Add USER directive in Dockerfile
- **DEFAULT_CREDENTIALS:** Use secure credentials from environment
- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

## File: rmq.js

**Path:** `/home/yousef/dev/E-commerce/services/Users/src/rmq.js`

**Issues:** 1

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 8

### Code Context

```
import amqplib from 'amqplib';
import { randomUUID } from 'crypto';

let ch;
const QUEUE_CREATE = 'auth.user.create';

export async function initRMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const conn = await amqplib.connect(url);
  ch = await conn.createChannel();
  await ch.assertQueue(QUEUE_CREATE, { durable: true });
  console.log('[users-svc] RMQ connected');
}

/**
 * RPC to Auth: ask to provision a Keycloak user.
 * Returns: { ok: boolean, keycloakUserId?: string, error?: any }
 */
export async function rpcProvisionInAuth(payload, timeoutMs = 10000) {
  if (!ch) throw new Error('RMQ channel not ready');

  const { queue } = await ch.assertQueue('', { exclusive: true, autoDelete: true });
  const correlationId = randomUUID();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'rpc_timeout' });
      ch.deleteQueue(queue).catch(() => {});
    }, timeoutMs);

    ch.consume(queue, (msg) => {
      if (!msg || msg.properties.correlationId !== correlationId) return;
      clearTimeout(timer);
      const data = JSON.parse(msg.content.toString());
      resolve(data);
      ch.cancel(msg.fields.consumerTag).catch(() => {});
      ch.deleteQueue(queue).catch(() => {});
    }, { noAck: true });

    ch.sendToQueue(
      QUEUE_CREATE,
      Buffer.from(JSON.stringify(payload)),
      { replyTo: queue, correlationId, persistent: true }
    );
  });
}

```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

## File: config.js

**Path:** `/home/yousef/dev/E-commerce/services/Shipping/src/config.js`

**Issues:** 1

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 18

### Code Context

```
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration values for the shipping service.
 *
 * The easypostApiKey is intentionally optional; if undefined the service will
 * throw when trying to call the external API.  In production this should be
 * required and validated.
 */
export const env = {
  port: process.env.PORT || 3004,
  mongoUri: process.env.MONGO_URI || 'mongodb://shipping-mongo:27017/shippingdb',
  easypostApiKey: process.env.EASYPOST_API_KEY,
  // URI for the RabbitMQ broker. Defaults to guest/guest over plain AMQP.
  rabbitmqUri: process.env.RABBITMQ_URI || 'amqp://guest:guest@rabbitmq:5672',
};
```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

## File: broker.js

**Path:** `/home/yousef/dev/E-commerce/services/Shipping/src/broker.js`

**Issues:** 1

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 16

### Code Context

```
import amqp from 'amqplib';

/**
 * Simple RabbitMQ connection helper for the shipping service.
 *
 * This service uses the default guest/guest credentials and plain AMQP
 * protocol to connect to a RabbitMQ broker. This is intentionally
 * insecure: no TLS, no authentication beyond the default account, and
 * no credential rotation. In a production environment you should
 * configure a strong user/password, enable TLS (amqps) and enforce
 * access control policies on the broker.
 */
let channel;

export async function initRabbit() {
  const uri = process.env.RABBITMQ_URI || 'amqp://guest:guest@rabbitmq:5672';
  const connection = await amqp.connect(uri);
  channel = await connection.createChannel();
  console.log(`[shipping-svc] connected to RabbitMQ at ${uri}`);
  return channel;
}

export function getChannel() {
  return channel;
}
```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

## File: config.js

**Path:** `/home/yousef/dev/E-commerce/services/Payment/src/config.js`

**Issues:** 1

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 14

### Code Context

```
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

/**
 * Configuration values for the payment service.
 */
export const env = {
  port: process.env.PORT || 3002,
  mongoUri: process.env.MONGO_URI || 'mongodb://payment-mongo:27017/paymentdb',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  // URI for the RabbitMQ broker. Defaults to guest/guest over plain AMQP.
  rabbitmqUri: process.env.RABBITMQ_URI || 'amqp://guest:guest@rabbitmq:5672',
};
```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

## File: broker.js

**Path:** `/home/yousef/dev/E-commerce/services/Payment/src/broker.js`

**Issues:** 1

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 22

### Code Context

```
import amqp from 'amqplib';

/**
 * Simple RabbitMQ connection helper.
 *
 * This module establishes a single connection and channel to a RabbitMQ
 * instance when `initRabbit` is called. It deliberately uses the insecure
 * `amqp://guest:guest@rabbitmq:5672` URI by default. In production you
 * should use TLS (`amqps://`), set up a dedicated user with strong
 * credentials, rotate those credentials regularly and restrict network
 * access to the broker. The default guest/guest account is only intended
 * for local use and leaving it enabled is a common misconfiguration.
 */
let channel;

/**
 * Initialise the RabbitMQ connection and channel.
 *
 * @returns {Promise<import('amqplib').Channel>} The created channel.
 */
export async function initRabbit() {
  const uri = process.env.RABBITMQ_URI || 'amqp://guest:guest@rabbitmq:5672';
  const connection = await amqp.connect(uri);
  channel = await connection.createChannel();
  console.log(`[payment-svc] connected to RabbitMQ at ${uri}`);
  return channel;
}

/**
 * Get the current RabbitMQ channel. Returns undefined if the channel has
 * not been initialised yet.
 */
export function getChannel() {
  return channel;
}
```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

## File: config.js

**Path:** `/home/yousef/dev/E-commerce/services/Notifications/src/config.js`

**Issues:** 2

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 13

**[INSECURE_HTTP]** - MEDIUM
- Description: HTTP connection instead of HTTPS
- Location: Line 20

### Code Context

```
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

/**
 * Configuration values for the notifications service.
 */
export const env = {
  port: process.env.PORT || 3003,
  mongoUri: process.env.MONGO_URI || 'mongodb://notifications-mongo:27017/notificationsdb',
  // URI for the RabbitMQ broker. Defaults to guest/guest over plain AMQP.
  rabbitmqUri: process.env.RABBITMQ_URI || 'amqp://guest:guest@rabbitmq:5672',
  // MailerSend API key for sending real emails
  mailersendApiKey: process.env.MAILERSEND_API_KEY,
  // Sender email (must be verified in MailerSend)
  mailersendFromEmail: process.env.MAILERSEND_FROM_EMAIL || 'noreply@yourdomain.com',
  mailersendFromName: process.env.MAILERSEND_FROM_NAME || 'E-Commerce Platform',
  // Users service URL for fetching user emails
  usersServiceUrl: process.env.USERS_SERVICE_URL || 'http://users:4002',
  // Mock API configurations (fallback when MailerSend is not configured)
  mockEmailApi: process.env.MOCK_EMAIL_API || 'https://jsonplaceholder.typicode.com/posts',
  mockSmsApi: process.env.MOCK_SMS_API || 'https://jsonplaceholder.typicode.com/posts',
};
```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)
- **INSECURE_HTTP:** Use HTTPS instead of HTTP


---

## File: config.js

**Path:** `/home/yousef/dev/E-commerce/services/Auth/src/config.js`

**Issues:** 1

### Vulnerabilities

**[PLAINTEXT_BROKER]** - HIGH
- Description: Message broker connection not encrypted (no TLS)
- Location: Line 40

### Code Context

```
// src/config.js
import 'dotenv/config';

/**
 * Centralized configuration with minimal validation.
 */
const requireEnv = (name, fallback = undefined) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`[config] Missing required env: ${name}`);
  }
  return v;
};

const KC_URL   = requireEnv('KC_URL');
const KC_REALM = requireEnv('KC_REALM');

export const env = Object.freeze({
  port: Number(process.env.PORT ?? 3001),

  kc: {
    url: KC_URL,
    realm: KC_REALM,
    issuer: `${KC_URL}/realms/${KC_REALM}`,
    jwksUri: `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/certs`,
    tokenEndpoint: `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`,
    userinfoEndpoint: `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/userinfo`,
    revokeEndpoint: `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/logout`,
    adminBase: `${KC_URL}/admin/realms/${KC_REALM}`,
    clientId: requireEnv('KC_CLIENT_ID'),
    clientSecret: requireEnv('KC_CLIENT_SECRET')
  },

  mongo: {
    uri: process.env.MONGO_URI || '',
    db: process.env.MONGO_DB || 'ecomm_auth'
  },

  rmq: {
    url: requireEnv('RABBITMQ_URL', 'amqp://guest:guest@rabbitmq:5672'),
    queueCreate: 'auth.user.create'
  },

  internal: {
    allowedClients: (process.env.INTERNAL_ALLOWED_CLIENTS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean) // e.g., ['users-svc']
  },

  cors: {
    // optionally set CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
    origins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  }
});

```

### Required Fixes

- **PLAINTEXT_BROKER:** Enable TLS (amqp:// → amqps://)


---

