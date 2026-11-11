/* eslint-disable */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const assert = require("assert/strict");

const moduleCache = new Map();

function loadTsModule(filePath) {
  const resolved = path.resolve(filePath);
  if (moduleCache.has(resolved)) {
    return moduleCache.get(resolved).exports;
  }

  const content = fs.readFileSync(resolved, "utf8");
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const m = { exports: {} };
  moduleCache.set(resolved, m);

  const customRequire = (specifier) => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(resolved);
      let targetPath = path.resolve(dir, specifier);
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".tsx")) {
        targetPath += ".tsx";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".js")) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    if (specifier.startsWith("@/")) {
      let targetPath = path.resolve(__dirname, "..", "src", specifier.slice(2));
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".tsx")) {
        targetPath += ".tsx";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".js")) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function("require", "exports", "module", "__dirname", "__filename", transpiled);
  fn(customRequire, m.exports, m, path.dirname(resolved), resolved);
  return m.exports;
}

async function runSupportTests() {
  console.log("=== Running LingoPDF Support Page & Contact Endpoint Test Suite ===");

  // Set mock environment for tests
  process.env.EMAIL_MOCK = "true";
  process.env.NODE_ENV = "test";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.lingopdf.in";
  process.env.RATE_LIMIT_HMAC_SECRET = "test-hmac-secret-with-sufficient-entropy-32chars";

  // ---------------------------------------------------------------------------
  // 1. Zod Validation Tests (contactFormSchema)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 1] Contact Form Schema Validation");
  const validationMod = loadTsModule(path.resolve(__dirname, "../src/lib/contact/validation.ts"));
  const { contactFormSchema } = validationMod;

  // 1a. Valid submission with all fields
  const validAll = contactFormSchema.safeParse({
    name: "Anna Müller",
    email: "  ANNA.MUELLER@example.de  ",
    subject: "Vocabulary lookup question",
    browser: "Chrome",
    message: "How does offline OCR work for German Fraktur fonts?",
  });
  assert.equal(validAll.success, true);
  if (validAll.success) {
    assert.equal(validAll.data.name, "Anna Müller");
    assert.equal(validAll.data.email, "anna.mueller@example.de");
    assert.equal(validAll.data.browser, "Chrome");
  }

  // 1b. Valid submission without optional browser
  const validNoBrowser = contactFormSchema.safeParse({
    name: "Max Mustermann",
    email: "max@example.com",
    subject: "Feedback on vocabulary preview",
    message: "Great extension, looking forward to French edition!",
  });
  assert.equal(validNoBrowser.success, true);

  // 1c. Missing required fields
  assert.equal(contactFormSchema.safeParse({ email: "a@b.com", subject: "Sub", message: "Msg" }).success, false, "Missing name must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", subject: "Sub", message: "Msg" }).success, false, "Missing email must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", message: "Msg" }).success, false, "Missing subject must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", subject: "Sub" }).success, false, "Missing message must fail");

  // 1d. Whitespace-only fields must be rejected
  assert.equal(contactFormSchema.safeParse({ name: "   ", email: "a@b.com", subject: "Sub", message: "Msg" }).success, false, "Whitespace name must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", subject: "   ", message: "Msg" }).success, false, "Whitespace subject must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", subject: "Sub", message: "   \n\t  " }).success, false, "Whitespace message must fail");

  // 1e. Invalid email formats
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "not-an-email", subject: "Sub", message: "Msg" }).success, false);
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "user@invalid", subject: "Sub", message: "Msg" }).success, false);
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "@missinguser.com", subject: "Sub", message: "Msg" }).success, false);

  // 1f. Field maximum lengths
  const over100Name = "A".repeat(101);
  const over254Email = "a".repeat(243) + "@example.com"; // 255 chars
  const over150Subject = "S".repeat(151);
  const over5000Message = "M".repeat(5001);
  const over50Browser = "B".repeat(51);

  assert.equal(contactFormSchema.safeParse({ name: over100Name, email: "a@b.com", subject: "Sub", message: "Msg" }).success, false, "Name > 100 must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: over254Email, subject: "Sub", message: "Msg" }).success, false, "Email > 254 must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", subject: over150Subject, message: "Msg" }).success, false, "Subject > 150 must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", subject: "Sub", message: over5000Message }).success, false, "Message > 5000 must fail");
  assert.equal(contactFormSchema.safeParse({ name: "Name", email: "a@b.com", subject: "Sub", message: "Msg", browser: over50Browser }).success, false, "Browser > 50 must fail");

  console.log("✓ Contact form Zod validation passed: required fields, trims, email validation, and length bounds verified.");

  // ---------------------------------------------------------------------------
  // 2. Email Rendering & Template Security Tests
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2] Email Template Rendering & HTML Escaping");
  const templateMod = loadTsModule(path.resolve(__dirname, "../src/lib/email/templates.ts"));
  const { renderSupportContactEmail } = templateMod;

  const xssPayload = "<script>alert('xss')</script> & <b>bold</b> \"quotes\" 'single'";
  const rendered = renderSupportContactEmail({
    name: `Hacker ${xssPayload}`,
    email: "hacker@example.com",
    subject: `Urgent Help ${xssPayload}`,
    message: `Hello,\nThis is line 1.\n${xssPayload}\nLine 3.`,
    browser: `Chrome <script>`,
    timestamp: new Date("2026-11-11T12:00:00Z"),
  });

  // Verify XSS prevention in HTML output
  assert.equal(rendered.html.includes("<script>"), false, "HTML must never contain raw <script> tag");
  assert.ok(rendered.html.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"), "XSS payload must be escaped in HTML");
  assert.ok(rendered.html.includes("&amp;"), "Ampersands must be escaped");
  assert.ok(rendered.html.includes("&quot;quotes&quot;"), "Quotes must be escaped");
  assert.ok(rendered.html.includes("<br>"), "Newlines must be converted to <br>");
  assert.ok(rendered.html.includes("hacker@example.com"));

  // Verify plain text version contains unescaped text cleanly
  assert.ok(rendered.text.includes("Hacker <script>alert('xss')</script>"));
  assert.ok(rendered.text.includes("This is line 1."));
  assert.ok(rendered.text.includes("hacker@example.com"));
  assert.ok(rendered.text.includes("Reply-To: hacker@example.com"));
  assert.equal(rendered.subject, `[LingoPDF Support] Urgent Help ${xssPayload}`);

  console.log("✓ Email template rendering verified: strict HTML escaping, plain-text fallback, and Reply-To instructions.");

  // ---------------------------------------------------------------------------
  // 3. API Route Handler Security & Behavior Tests
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3] Contact API Route (/api/contact) Security & Endpoints");
  const { NextRequest } = require("next/server");
  const rateLimitMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/rateLimit.ts"));
  const { setTestRateLimitStore, createInMemoryRateLimitStore, RATE_LIMIT_POLICIES } = rateLimitMod;
  const contactRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/contact/route.ts"));

  // Verify rate-limit policy definition for contact
  assert.ok(RATE_LIMIT_POLICIES.contact, "contact policy must exist");
  assert.equal(RATE_LIMIT_POLICIES.contact.ipLimit, 5, "IP limit must be 5 per hour");
  assert.equal(RATE_LIMIT_POLICIES.contact.emailLimit, 3, "Email limit must be 3 per hour");
  assert.equal(RATE_LIMIT_POLICIES.contact.windowSeconds, 3600, "Window must be 3600s (1 hour)");

  // Initialize test in-memory rate-limit store for route tests
  setTestRateLimitStore(createInMemoryRateLimitStore());

  // 3a. CSRF / Origin rejection: cross-origin forbidden
  const crossOriginReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://malicious-site.example",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.10",
    },
    body: JSON.stringify({
      name: "User",
      email: "user@example.com",
      subject: "Test",
      message: "Hello world",
    }),
  });
  const crossOriginRes = await contactRoute.POST(crossOriginReq);
  assert.equal(crossOriginRes.status, 403, "Cross-origin request must be rejected with 403");

  // 3b. Missing origin and referer
  const missingOriginReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "198.51.100.10",
    },
    body: JSON.stringify({
      name: "User",
      email: "user@example.com",
      subject: "Test",
      message: "Hello world",
    }),
  });
  const missingOriginRes = await contactRoute.POST(missingOriginReq);
  assert.equal(missingOriginRes.status, 403, "Missing origin and referer must be rejected with 403");

  // 3c. Invalid Content-Type
  const wrongContentTypeReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "text/plain",
      "x-real-ip": "198.51.100.10",
    },
    body: "Hello",
  });
  const wrongContentTypeRes = await contactRoute.POST(wrongContentTypeReq);
  assert.equal(wrongContentTypeRes.status, 415, "Non-JSON content type must return 415");

  // 3d. Spam Honeypot rejection
  const honeypotReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.10",
    },
    body: JSON.stringify({
      name: "Spam Bot",
      email: "bot@spam.com",
      subject: "Buy crypto",
      message: "Special discount link here",
      hp_website: "http://spam.example.com", // Honeypot filled!
    }),
  });
  const honeypotRes = await contactRoute.POST(honeypotReq);
  assert.equal(honeypotRes.status, 400, "Honeypot submission must return 400");
  const honeypotData = await honeypotRes.json();
  assert.equal(honeypotData.code, "SPAM_REJECTED");

  // 3e. Valid submission (mock email delivery)
  setTestRateLimitStore(createInMemoryRateLimitStore());
  const validReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.20",
    },
    body: JSON.stringify({
      name: "Johannes Kepler",
      email: "kepler@observatory.org",
      subject: "Feature inquiry on German astronomy vocabulary",
      browser: "Chrome",
      message: "LingoPDF works wonderfully for 17th-century German texts. Thank you!",
    }),
  });
  const validRes = await contactRoute.POST(validReq);
  assert.equal(validRes.status, 200, "Valid submission must return 200");
  const validData = await validRes.json();
  assert.equal(validData.code, "MESSAGE_SENT");
  assert.ok(validData.message.includes("Thank you for contacting LingoPDF. Your message has been sent successfully."));

  // 3f. Email Rate Limiting (max 3 submissions per hour per email)
  const testEmail = "rate-limit-test@lingopdf.in";
  setTestRateLimitStore(createInMemoryRateLimitStore());

  for (let i = 1; i <= 3; i++) {
    const req = new NextRequest("https://www.lingopdf.in/api/contact", {
      method: "POST",
      headers: {
        origin: "https://www.lingopdf.in",
        "content-type": "application/json",
        "x-real-ip": `198.51.100.${30 + i}`, // Different IPs, same email
      },
      body: JSON.stringify({
        name: `Tester ${i}`,
        email: testEmail,
        subject: `Test ${i}`,
        message: `Message body ${i}`,
      }),
    });
    const res = await contactRoute.POST(req);
    assert.equal(res.status, 200, `Submission ${i} for email must succeed`);
  }

  // 4th submission with same email must be rate-limited (HTTP 429)
  const fourthEmailReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.99",
    },
    body: JSON.stringify({
      name: "Tester 4",
      email: testEmail,
      subject: "Test 4",
      message: "Message body 4",
    }),
  });
  const fourthEmailRes = await contactRoute.POST(fourthEmailReq);
  assert.equal(fourthEmailRes.status, 429, "4th submission for same email must be rate-limited with HTTP 429");
  assert.ok(fourthEmailRes.headers.get("Retry-After"), "429 must include Retry-After header");
  const rateLimitEmailData = await fourthEmailRes.json();
  assert.equal(rateLimitEmailData.code, "RATE_LIMITED");

  // 3g. IP Rate Limiting (max 5 submissions per hour per IP)
  setTestRateLimitStore(createInMemoryRateLimitStore());
  const fixedIp = "203.0.113.88";

  for (let i = 1; i <= 5; i++) {
    const req = new NextRequest("https://www.lingopdf.in/api/contact", {
      method: "POST",
      headers: {
        origin: "https://www.lingopdf.in",
        "content-type": "application/json",
        "x-real-ip": fixedIp, // Same IP, different emails
      },
      body: JSON.stringify({
        name: `User ${i}`,
        email: `unique-user-${i}@example.com`,
        subject: `Inquiry ${i}`,
        message: `Inquiry message ${i}`,
      }),
    });
    const res = await contactRoute.POST(req);
    assert.equal(res.status, 200, `Submission ${i} from IP ${fixedIp} must succeed`);
  }

  // 6th submission from same IP must be rate-limited (HTTP 429)
  const sixthIpReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "application/json",
      "x-real-ip": fixedIp,
    },
    body: JSON.stringify({
      name: "User 6",
      email: "unique-user-6@example.com",
      subject: "Inquiry 6",
      message: "Inquiry message 6",
    }),
  });
  const sixthIpRes = await contactRoute.POST(sixthIpReq);
  assert.equal(sixthIpRes.status, 429, "6th submission from same IP must be rate-limited with HTTP 429");
  assert.ok(sixthIpRes.headers.get("Retry-After"), "429 must include Retry-After header");
  const rateLimitIpData = await sixthIpRes.json();
  assert.equal(rateLimitIpData.code, "RATE_LIMITED");

  // 3h. Resend Failure Handling (safe error response, no leaked keys or secrets)
  // Temporarily disable mock and unconfigure API key to simulate delivery failure
  process.env.EMAIL_MOCK = "false";
  const oldResendKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  setTestRateLimitStore(createInMemoryRateLimitStore());
  const failReq = new NextRequest("https://www.lingopdf.in/api/contact", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.55",
    },
    body: JSON.stringify({
      name: "Delivery Test",
      email: "delivery-test@example.com",
      subject: "Test Resend failure",
      message: "Testing that error messages are safe",
    }),
  });
  const failRes = await contactRoute.POST(failReq);
  assert.equal(failRes.status, 500, "Resend failure must return HTTP 500");
  const failData = await failRes.json();
  assert.equal(failData.code, "DELIVERY_FAILED");
  assert.ok(failData.error.includes("Unable to send your message right now"));
  assert.equal(failData.error.includes("RESEND_API_KEY"), false, "Must not leak internal configuration details");

  // Restore env
  process.env.EMAIL_MOCK = "true";
  if (oldResendKey) {
    process.env.RESEND_API_KEY = oldResendKey;
  }

  console.log("✓ Contact API route verified: CSRF defense, honeypot spam protection, IP/Email rate limiting (429), and safe Resend error handling.");

  // ---------------------------------------------------------------------------
  // 4. FAQ Questions & Answers Verification
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4] FAQ Questions & Content Accuracy");
  const supportPageContent = fs.readFileSync(path.resolve(__dirname, "../src/app/support/page.tsx"), "utf8");

  const EXPECTED_FAQS = [
    {
      q: "What is LingoPDF?",
      a: "LingoPDF is a vocabulary-building PDF reader that helps you understand unfamiliar German words while reading. Select a word to see its English meaning and relevant grammatical information without switching to another application.",
    },
    {
      q: "Which languages are currently supported?",
      a: "The currently available edition focuses on German-to-English vocabulary lookup. Additional language editions, including French and Italian, are planned for the future.",
    },
    {
      q: "Does LingoPDF translate the entire PDF?",
      a: "No. LingoPDF is designed for vocabulary learning, not whole-document translation. It helps you understand individual words and their meanings in the context of your reading.",
    },
    {
      q: "Can I use LingoPDF with scanned PDFs?",
      a: "Yes. LingoPDF includes local OCR functionality for scanned PDF pages. OCR processing happens on your device, and scanned page images are not uploaded to LingoPDF servers.",
    },
    {
      q: "Are my PDF documents uploaded to your servers?",
      a: "No. PDF reading, text processing, dictionary lookup and OCR are designed to run locally on your device. LingoPDF does not upload your PDF contents to its servers.",
    },
    {
      q: "Does LingoPDF work offline?",
      a: "The current extension's PDF reading and local dictionary functionality are designed for offline use. Future commercial licensing may require periodic online verification. Consult the product documentation for the current release's requirements.",
    },
    {
      q: "Is LingoPDF free?",
      a: "LingoPDF is currently available free of charge to a limited group of invited testers during its private promotional preview. There is no permanent public free tier or free trial planned for the commercial launch.",
    },
    {
      q: "How can I report a problem or request help?",
      a: "You can use the contact form on this page or email support@lingopdf.in. Please include a description of the issue and the browser you are using. Never send passwords or sensitive personal information.",
    },
  ];

  assert.equal(EXPECTED_FAQS.length, 8, "Must have exactly 8 FAQs");
  for (const faq of EXPECTED_FAQS) {
    assert.ok(supportPageContent.includes(faq.q), `Support page must contain question: "${faq.q}"`);
    assert.ok(supportPageContent.includes(faq.a), `Support page must contain answer for: "${faq.q}"`);
  }

  // Verify FAQ JSON-LD structured data is present
  assert.ok(supportPageContent.includes('"@type": "FAQPage"'), "Page must include FAQPage JSON-LD");

  // Verify hero section copy
  assert.ok(supportPageContent.includes("We&apos;re here to help.") || supportPageContent.includes("We're here to help."));
  assert.ok(supportPageContent.includes("Whether you have a question about using LingoPDF"));
  assert.ok(supportPageContent.includes("support@lingopdf.in"));
  assert.ok(supportPageContent.includes("mailto:support@lingopdf.in"));

  console.log("✓ All 8 FAQs and Hero copy accurately present on Support page with JSON-LD structured data.");

  // ---------------------------------------------------------------------------
  // 5. Navigation & Site Configuration Links
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5] Navigation Links (Navbar & Footer)");
  const siteConfigMod = loadTsModule(path.resolve(__dirname, "../src/lib/siteConfig.ts"));
  const { siteConfig } = siteConfigMod;
  const supportNavLink = siteConfig.navLinks.find((l) => l.href === "/support");
  assert.ok(supportNavLink, "Navbar navLinks must include /support");
  assert.equal(supportNavLink.label, "Support");

  const footerContent = fs.readFileSync(path.resolve(__dirname, "../src/components/Footer.tsx"), "utf8");
  assert.ok(footerContent.includes('href="/support"'), "Footer must link to /support");

  console.log("✓ Navigation verified: /support present in siteConfig.navLinks and Footer.");

  // ---------------------------------------------------------------------------
  // 6. Privacy Policy Updates Verification
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6] Privacy Policy Support Form Disclosures");
  const privacyContent = fs.readFileSync(path.resolve(__dirname, "../src/app/privacy/page.tsx"), "utf8");
  assert.ok(privacyContent.includes("https://www.lingopdf.in/support"), "Privacy policy must mention support page");
  assert.ok(privacyContent.includes("name, email address, subject, message contents"), "Privacy policy must mention contact form fields");
  assert.ok(privacyContent.includes("optional browser information"), "Privacy policy must mention optional browser info");
  assert.ok(privacyContent.includes("rate-limiting"), "Privacy policy must mention rate-limiting metadata");
  assert.ok(privacyContent.includes("support contact form transmissions"), "Privacy policy must mention Resend delivering support contacts");

  console.log("✓ Privacy policy updates verified: contact form processing and Resend transmission disclosures accurate.");

  // ---------------------------------------------------------------------------
  // 7. Mobile & Desktop Responsive Layout, Accessibility & Client Component Integrity
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7] Mobile & Desktop Responsive Layout and Accessibility Integrity");
  const formClientContent = fs.readFileSync(path.resolve(__dirname, "../src/app/support/ContactFormClient.tsx"), "utf8");

  // Form labels and accessibility associations
  assert.ok(formClientContent.includes('htmlFor="contact-name"'), "Name input must have matching htmlFor label");
  assert.ok(formClientContent.includes('id="contact-name"'), "Name input must have id contact-name");
  assert.ok(formClientContent.includes('htmlFor="contact-email"'), "Email input must have matching htmlFor label");
  assert.ok(formClientContent.includes('id="contact-email"'), "Email input must have id contact-email");
  assert.ok(formClientContent.includes('htmlFor="contact-subject"'), "Subject input must have matching htmlFor label");
  assert.ok(formClientContent.includes('id="contact-subject"'), "Subject input must have id contact-subject");
  assert.ok(formClientContent.includes('htmlFor="contact-browser"'), "Browser select must have matching htmlFor label");
  assert.ok(formClientContent.includes('id="contact-browser"'), "Browser select must have id contact-browser");
  assert.ok(formClientContent.includes('htmlFor="contact-message"'), "Message textarea must have matching htmlFor label");
  assert.ok(formClientContent.includes('id="contact-message"'), "Message textarea must have id contact-message");

  // Honeypot hidden from screen readers and view
  assert.ok(formClientContent.includes('style={{ display: "none" }} aria-hidden="true"'), "Honeypot container must be visually and semantically hidden");
  assert.ok(formClientContent.includes('tabIndex={-1}'), "Honeypot input must not be focusable in tab sequence");

  // Accessible alert / live regions
  assert.ok(formClientContent.includes('role="status"') && formClientContent.includes('aria-live="polite"'), "Success announcement must use accessible live region");
  assert.ok(formClientContent.includes('role="alert"') && formClientContent.includes('aria-live="assertive"'), "Error announcement must use accessible alert region");

  // Duplicate submission prevention & loading state
  assert.ok(formClientContent.includes('if (isSubmitting) return;'), "Duplicate submit handler must guard against concurrent submissions");
  assert.ok(formClientContent.includes('disabled={isSubmitting}'), "Form controls must be disabled during submission");
  assert.ok(formClientContent.includes('Send Message'), "Button must render Send Message label");
  assert.ok(formClientContent.includes('Sending...'), "Button must render loading state while submitting");

  // Responsive layout classes (mobile-first grid & padding breakpoints)
  assert.ok(formClientContent.includes('grid-cols-1 sm:grid-cols-2'), "Name/Email row must be responsive (1 col on mobile, 2 col on sm+)");
  assert.ok(formClientContent.includes('grid-cols-1 sm:grid-cols-3'), "Subject/Browser row must be responsive (1 col on mobile, 3 col on sm+)");
  assert.ok(formClientContent.includes('p-6 sm:p-8 lg:p-10'), "Form container must use responsive padding");
  assert.ok(supportPageContent.includes('py-12 sm:py-16 lg:py-20'), "Support page main must use responsive vertical padding");
  assert.ok(supportPageContent.includes('grid-cols-1 md:grid-cols-3'), "Support info cards must be responsive (1 col mobile, 3 col desktop)");

  // FaqAccordion keyboard & WAI-ARIA accessibility
  const faqAccordionContent = fs.readFileSync(path.resolve(__dirname, "../src/components/FaqAccordion.tsx"), "utf8");
  assert.ok(faqAccordionContent.includes('aria-expanded={isOpen}'), "FAQ button must toggle aria-expanded");
  assert.ok(faqAccordionContent.includes('aria-controls={panelId}'), "FAQ button must reference panel with aria-controls");
  assert.ok(faqAccordionContent.includes('role="region"'), "FAQ panel must declare role region");
  assert.ok(faqAccordionContent.includes('aria-labelledby={buttonId}'), "FAQ panel must declare aria-labelledby matching button");

  console.log("✓ Responsive layout and accessibility verified: full WAI-ARIA compliance, responsive grids, and duplicate submit guards.");

  console.log("\n🎉 ALL SUPPORT PAGE & CONTACT ENDPOINT TESTS PASSED SUCCESSFULLY!\n");
}

runSupportTests().catch((err) => {
  console.error("\n❌ Support test suite failed:", err);
  process.exit(1);
});
