// Glowbough — creates a Stripe Checkout page for the pack the customer picked.
// Needs one environment variable in Netlify: STRIPE_SECRET_KEY (sk_test_... or sk_live_...).

const PACKS = {
  1: { title: "Merrybeam Christmas Projector", amount: 2499, shipping: { amount: 499, name: "Standard Shipping" } },
  2: { title: "Merrybeam Christmas Projector – 2 Pack", amount: 3999, shipping: { amount: 0, name: "Free Shipping" } },
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function buildParams({ pack }, site) {
  const p = PACKS[pack];
  if (!p) throw new Error("Pick a pack.");
  const f = new URLSearchParams();
  f.append("mode", "payment");
  f.append("success_url", `${site}/thanks.html`);
  f.append("cancel_url", `${site}/#order`);
  f.append("line_items[0][price_data][currency]", "usd");
  f.append("line_items[0][price_data][unit_amount]", String(p.amount));
  f.append("line_items[0][price_data][product_data][name]", p.title);
  f.append("line_items[0][price_data][product_data][description]", "USB-powered Christmas projector light with bendable metal neck.");
  f.append("line_items[0][price_data][product_data][images][0]", `${site}/img/tree.jpg`);
  f.append("line_items[0][quantity]", "1");
  f.append("line_items[0][adjustable_quantity][enabled]", "true");
  f.append("line_items[0][adjustable_quantity][minimum]", "1");
  f.append("line_items[0][adjustable_quantity][maximum]", "10");
  f.append("shipping_address_collection[allowed_countries][0]", "US");
  f.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  f.append("shipping_options[0][shipping_rate_data][display_name]", p.shipping.name);
  f.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(p.shipping.amount));
  f.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
  f.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  f.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "2");
  f.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  f.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "5");
  f.append("phone_number_collection[enabled]", "true");
  f.append("payment_intent_data[description]", p.title);
  f.append("payment_intent_data[metadata][pack]", pack == 2 ? "2 Pack" : "Single");
  return f;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(500, { error: "Checkout isn't set up yet." });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Bad request." }); }
  const site = (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");
  let params;
  try { params = buildParams(body, site); } catch (e) { return json(400, { error: e.message }); }
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const d = await r.json();
  if (!r.ok) { console.error("Stripe error:", d.error?.message); return json(502, { error: "Checkout is unavailable right now." }); }
  return json(200, { url: d.url });
};
