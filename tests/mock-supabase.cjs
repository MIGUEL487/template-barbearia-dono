const http = require("http");
const shop = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uid = "99999999-9999-4999-8999-999999999999";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const fixtures = {
  shop_members: {
    barbershop_id: shop,
    role: "owner",
    barbershops: { name: "Auto Stilo · fixture local" },
  },
  financial_transactions: [
    { amount: 45, type: "income", created_at: new Date().toISOString() },
  ],
  bookings: [],
  payments: [],
  customers: [],
  barbers: [
    {
      id: "22222222-2222-4222-8222-222222222221",
      name: "Profissional fixture",
      bio: "Teste local",
      is_active: true,
    },
  ],
  services: [
    {
      id: "33333333-3333-4333-8333-333333333331",
      name: "Corte fixture",
      price: 45,
      duration_minutes: 40,
      is_active: true,
    },
  ],
  site_settings: { brand_name: "Auto Stilo" },
  working_hours: [],
  barber_services: [],
};
let memberRole = "owner",
  rpcCalls = 0;
fixtures.bookings = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    barber_id: fixtures.barbers[0].id,
    starts_at: new Date().toISOString().slice(0, 10) + "T10:15:00Z",
    status: "confirmed",
    total_price: 45,
    customers: { name: "Cliente fixture", phone: "00000000" },
    booking_items: [{ service_name: "Corte fixture" }],
    barbers: { name: "Profissional fixture" },
    payments: [],
  },
];
const server = http.createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader(
    "access-control-allow-methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("content-type", "application/json");
  if (req.url.startsWith("/fixture/role/")) {
    memberRole = req.url.split("/").at(-1);
    res.end("{}");
    return;
  }
  if (req.url === "/fixture/stats") {
    res.end(JSON.stringify({ rpcCalls }));
    return;
  }
  if (req.url.includes("/rest/v1/rpc/")) rpcCalls++;
  fixtures.shop_members.role = memberRole;
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  if (req.url.startsWith("/auth/v1/user")) return res.end(JSON.stringify(user));
  const table = req.url.split("/rest/v1/")[1]?.split("?")[0];
  let out = fixtures[table] ?? [];
  if (
    table === "shop_members" &&
    !(req.headers.accept || "").includes("object")
  )
    out = [out];
  res.end(JSON.stringify(out));
});
server.listen(54329, "127.0.0.1");
