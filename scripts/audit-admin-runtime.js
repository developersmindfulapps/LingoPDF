/* eslint-disable */
const http = require('http');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const crypto = require('crypto');

async function testFetch() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  let uri = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('MONGODB_URI=')) {
      uri = line.slice('MONGODB_URI='.length).trim().replace(/^["']|["']$/g, '');
    }
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('lingo_pdf');
  const user = await db.collection('users').findOne({ email: 'developers.mindfulapps@gmail.com' });
  const rawToken = 'testadminsessiontokenforverification12345678901234567890';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  
  await db.collection('sessions').updateOne(
    { tokenHash },
    { $set: { userId: user._id, expiresAt: new Date(Date.now() + 86400000), lastActiveAt: new Date() } },
    { upsert: true }
  );

  const routes = [
    '/admin',
    '/admin/users',
    '/admin/purchases',
    '/admin/entitlements',
    '/admin/refunds',
    '/admin/disputes',
    '/admin/promotions',
    '/admin/referrals',
    '/admin/commissions',
    '/admin/payouts',
    '/admin/audit-logs',
    '/admin/settings',
    '/admin/system'
  ];

  for (const route of routes) {
    await new Promise((resolve) => {
      const req = http.get('http://localhost:3000' + route, {
        headers: {
          Cookie: 'lingopdf_session=' + rawToken
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Route [${route}] Status: ${res.statusCode}`);
          if (data.includes('Operational Error') || data.includes('Functions cannot be passed')) {
            console.log(`❌ ERROR found in ${route}!`);
            const idx = data.indexOf('Operational Error');
            if (idx !== -1) console.log(data.slice(idx, idx + 250));
            const idx2 = data.indexOf('Functions cannot be passed');
            if (idx2 !== -1) console.log(data.slice(idx2, idx2 + 250));
          } else {
            console.log(`✓ Clean render: ${route} (${data.length} bytes)`);
          }
          resolve();
        });
      });
      req.on('error', (err) => {
        console.log(`Failed request for ${route}:`, err.message);
        resolve();
      });
    });
  }

  await client.close();
}

testFetch();
