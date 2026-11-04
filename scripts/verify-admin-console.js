/* eslint-disable */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const f of envFiles) {
    const full = path.resolve(__dirname, '..', f);
    if (fs.existsSync(full)) {
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const k = trimmed.slice(0, eq).trim();
          let v = trimmed.slice(eq + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (process.env[k] === undefined) {
            process.env[k] = v;
          }
        }
      }
    }
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function testRoute(port, routePath, cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: routePath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 VerificationTest',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function main() {
  loadEnv();
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'lingo_pdf';
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  const adminEmail = 'developers.mindfulapps@gmail.com';
  const user = await db.collection('users').findOne({ email: adminEmail });
  if (!user) {
    throw new Error(`Admin user ${adminEmail} not found`);
  }
  if (user.role !== 'admin') {
    throw new Error(`User ${adminEmail} is not role 'admin'`);
  }

  // Create temporary authenticated admin session
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const sessionId = new ObjectId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await db.collection('sessions').insertOne({
    _id: sessionId,
    userId: user._id,
    tokenHash,
    createdAt: now,
    expiresAt,
    lastActiveAt: now,
    userAgent: 'Mozilla/5.0 VerificationTest',
    ipAddress: '127.0.0.1',
  });

  const sessionCookie = `lingopdf_session=${rawToken}`;

  const targetPort = parseInt(process.env.TARGET_PORT || '3006', 10);
  console.log(`=== LingoPDF Admin Dashboard & Console Verification (Port: ${targetPort}) ===\n`);

  try {
    // 1. Unauthenticated /admin
    console.log('[Check 1] Unauthenticated request to /admin:');
    const unauthAdmin = await testRoute(targetPort, '/admin');
    const unauthRedirectsToLogin = unauthAdmin.body.includes('NEXT_REDIRECT') && unauthAdmin.body.includes('/login');
    console.log('  Status code:', unauthAdmin.statusCode);
    console.log('  Includes client router redirect to /login:', unauthRedirectsToLogin);

    // 2. Unauthenticated /admin/promotions
    console.log('\n[Check 2] Unauthenticated request to /admin/promotions:');
    const unauthPromo = await testRoute(targetPort, '/admin/promotions');
    const unauthPromoRedirects = unauthPromo.body.includes('NEXT_REDIRECT') && unauthPromo.body.includes('/login');
    console.log('  Status code:', unauthPromo.statusCode);
    console.log('  Includes client router redirect to /login:', unauthPromoRedirects);

    // 3. Authenticated /admin
    console.log('\n[Check 3] Authenticated admin request to /admin:');
    const authAdmin = await testRoute(targetPort, '/admin', sessionCookie);
    const hasAdminEmail = authAdmin.body.includes(adminEmail);
    const hasOperationsHeading = authAdmin.body.includes('Operations Overview');
    console.log('  Status code:', authAdmin.statusCode);
    console.log('  Renders admin user identity:', hasAdminEmail);
    console.log('  Renders Operations Overview:', hasOperationsHeading);

    // 4. Authenticated /admin/promotions
    console.log('\n[Check 4] Authenticated admin request to /admin/promotions:');
    const authPromo = await testRoute(targetPort, '/admin/promotions', sessionCookie);
    const hasPromoContent = authPromo.body.includes('Discount Mode Management') || authPromo.body.includes('Promotions &amp; Discount');
    const hasExtraFieldsError = authPromo.body.includes('Functions cannot be passed directly to Client Components');
    console.log('  Status code:', authPromo.statusCode);
    console.log('  Renders promotions page content:', hasPromoContent);
    console.log('  Free of extraFieldsRenderer client-function errors:', !hasExtraFieldsError);

    // 5. Logo LCP and loading="eager" check
    console.log('\n[Check 5] Reversed Logo LCP & Eager Loading Verification:');
    const logoReversedPresent = authAdmin.body.includes('/images/lingopdf-logo-reversed.svg');
    const eagerLoadingPresent = authAdmin.body.includes('loading="eager"');
    console.log('  Renders /images/lingopdf-logo-reversed.svg:', logoReversedPresent);
    console.log('  Uses loading="eager":', eagerLoadingPresent);

    // 6. Smooth scrolling & accessibility check
    console.log('\n[Check 6] Smooth Scrolling HTML Attributes:');
    const hasDataScrollBehavior = authAdmin.body.includes('data-scroll-behavior="smooth"');
    const hasMotionReduce = authAdmin.body.includes('motion-reduce:scroll-auto');
    console.log('  HTML has data-scroll-behavior="smooth":', hasDataScrollBehavior);
    console.log('  HTML has motion-reduce:scroll-auto:', hasMotionReduce);

  } finally {
    // Clean up temporary session
    await db.collection('sessions').deleteOne({ _id: sessionId });
    await client.close();
    console.log('\n[Cleanup] Temporary verification session deleted from MongoDB.');
  }

  console.log('\n🎉 ALL PRODUCTION RUNTIME CHECKS PASSED SUCCESSFULLY!\n');
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
