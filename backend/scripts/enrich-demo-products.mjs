const baseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  'User-Agent': 'nauta-demo-seed/1.0',
};

const productCases = {
  'MDS-DEMO-PAST-070': {
    documentType: 'COMMERCIAL_INVOICE',
    cargo: {
      category: 'Furniture',
      product_name: 'Solid acacia wood sideboards',
      product_name_es: 'Aparadores de madera sólida de acacia',
      description: 'Two-door acacia sideboards, fully assembled',
      material: 'Solid acacia wood',
      condition: 'Assembled',
      hs_code: '9403.60',
      quantity: { units: 160, cartons: 320 },
      packaging: 'Double-wall corrugated cartons on ISPM-15 treated wooden pallets',
      gross_weight_kg: 16_400,
      declared_value_usd: 47_600,
      unit_declared_value_usd: 297.5,
      country_of_origin: 'Vietnam',
    },
  },
  'MDS-DEMO-RED-081': {
    documentType: 'CUSTOMS_DECLARATION',
    cargo: {
      category: 'Furniture',
      product_name: 'Five-piece bedroom sets',
      product_name_es: 'Recámaras compactas de cinco piezas',
      description: 'Bed frame, two nightstands, dresser, and mirror in engineered wood',
      material: 'Engineered wood with oak veneer',
      condition: 'KD (knock-down, unassembled)',
      hs_code: '9403.50',
      quantity: { sets: 120, cartons: 360 },
      packaging: 'Corrugated cartons on ISPM-15 treated wooden pallets',
      gross_weight_kg: 18_120,
      declared_value_usd: 68_500,
      unit_declared_value_usd: 570.83,
      country_of_origin: 'Vietnam',
    },
  },
  'MDS-DEMO-DELAY-083': {
    documentType: 'BOOKING_CONFIRMATION',
    cargo: {
      category: 'Furniture',
      product_name: 'Three-seat modular sofas',
      product_name_es: 'Sofás modulares de tres plazas',
      description: 'Upholstered modular sofas with removable cushions',
      material: 'Pine wood frame, foam, and polyester fabric',
      condition: 'KD (knock-down, unassembled)',
      hs_code: '9401.61',
      quantity: { units: 180, cartons: 360 },
      packaging: 'Reinforced corrugated cartons on ISPM-15 treated wooden pallets',
      gross_weight_kg: 19_050,
      declared_value_usd: 73_100,
      unit_declared_value_usd: 406.11,
      country_of_origin: 'Vietnam',
    },
  },
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${(await response.text()).slice(0, 1_000)}`);
  }

  return response;
}

for (const [referenceCode, { documentType, cargo }] of Object.entries(productCases)) {
  const [operation] = await (
    await request(
      `/rest/v1/operations?select=id,canonical_data&reference_code=eq.${referenceCode}`,
    )
  ).json();

  if (!operation) throw new Error(`Operation ${referenceCode} was not found.`);

  await request(`/rest/v1/operations?id=eq.${operation.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      canonical_data: {
        ...operation.canonical_data,
        cargo,
        commercial_terms: { incoterm: 'FOB Vietnam', currency: 'USD' },
      },
    }),
  });

  const [document] = await (
    await request(
      `/rest/v1/documents?select=id,extracted_json&operation_id=eq.${operation.id}&type=eq.${documentType}`,
    )
  ).json();

  if (!document) throw new Error(`${documentType} for ${referenceCode} was not found.`);

  await request(`/rest/v1/documents?id=eq.${document.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      extracted_json: { ...document.extracted_json, cargo },
    }),
  });
}

console.log(`Enriched ${Object.keys(productCases).length} demo operations.`);
