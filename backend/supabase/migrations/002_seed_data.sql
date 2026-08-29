-- =============================================================================
-- SEED DATA - NAUTA DEMO
-- Ejecutar en el editor SQL de Supabase después de 001_initial_schema.sql
-- =============================================================================

-- Limpiar datos existentes (opcional, cuidado en prod)
-- DELETE FROM operations; 

-- =============================================================================
-- 1. OPERATIONS
-- =============================================================================
INSERT INTO operations (id, client_name, reference_code, status, canonical_data, discrepancies, tags) VALUES
-- Operación 1: En tránsito, normal
('b2c3d4e5-0000-0000-0000-000000000001', 'TechLogistics Inc.', 'OP-2026-101', 'IN_TRANSIT', 
 '{"operation_id": "b2c3d4e5-0000-0000-0000-000000000001", "origin_port": {"value": "Shanghai"}, "destination_port": {"value": "Manzanillo"}, "status": "IN_TRANSIT"}', '[]', '{"VIP", "Electrónicos"}'),

-- Operación 2: Con excepción (ETA slip)
('c3d4e5f6-0000-0000-0000-000000000002', 'Global Foods', 'OP-2026-102', 'EXCEPTION',
 '{"operation_id": "c3d4e5f6-0000-0000-0000-000000000002", "origin_port": {"value": "Rotterdam"}, "destination_port": {"value": "Veracruz"}, "status": "EXCEPTION"}', '[]', '{"Perecederos"}'),

-- Operación 3: En aduana
('d4e5f6a7-0000-0000-0000-000000000003', 'AutoParts Latam', 'OP-2026-103', 'CUSTOMS_CLEARANCE',
 '{"operation_id": "d4e5f6a7-0000-0000-0000-000000000003", "origin_port": {"value": "Bremen"}, "destination_port": {"value": "Buenaventura"}, "status": "CUSTOMS_CLEARANCE"}', '[]', '{"Automotriz"}'),

-- Operación 4: Recién Booked (Faltan documentos)
('e5f6a7b8-0000-0000-0000-000000000004', 'Textiles del Sur', 'OP-2026-104', 'BOOKED',
 '{"operation_id": "e5f6a7b8-0000-0000-0000-000000000004", "origin_port": {"value": "Shenzhen"}, "destination_port": {"value": "Callao"}, "status": "BOOKED"}', '[]', '{"Retail"}'),

-- Operación 5: Discrepancia detectada por RECON
('f6a7b8c9-0000-0000-0000-000000000005', 'PharmaCare', 'OP-2026-105', 'AT_PORT',
 '{"operation_id": "f6a7b8c9-0000-0000-0000-000000000005", "origin_port": {"value": "Mumbai"}, "destination_port": {"value": "Santos"}, "status": "AT_PORT"}', 
 '[{"id":"disc-1","field":"total_declared_value_usd","severity":"CRITICAL","description":"Discrepancia en valor declarado","source_a":{"document_type":"COMMERCIAL_INVOICE","value":45000},"source_b":{"document_type":"CUSTOMS_DECLARATION","value":40000}}]', '{"Farma", "Refrigerado"}');

-- =============================================================================
-- 2. CONTAINERS
-- =============================================================================
INSERT INTO containers (id, operation_id, container_number, container_type, status, current_location, eta, original_eta) VALUES
-- Op 1
(uuid_generate_v4(), 'b2c3d4e5-0000-0000-0000-000000000001', 'MSKU1234567', '40HC', 'IN_TRANSIT', 'Océano Pacífico', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days'),
(uuid_generate_v4(), 'b2c3d4e5-0000-0000-0000-000000000001', 'MSKU7654321', '40HC', 'IN_TRANSIT', 'Océano Pacífico', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days'),

-- Op 2 (Exception)
(uuid_generate_v4(), 'c3d4e5f6-0000-0000-0000-000000000002', 'CMAU9876543', '20GP', 'AT_PORT', 'Puerto de Algeciras (Transbordo retrasado)', NOW() + INTERVAL '15 days', NOW() + INTERVAL '8 days'),

-- Op 3
(uuid_generate_v4(), 'd4e5f6a7-0000-0000-0000-000000000003', 'HLXU1122334', '40HC', 'CUSTOMS_HOLD', 'Aduana Buenaventura', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(uuid_generate_v4(), 'd4e5f6a7-0000-0000-0000-000000000003', 'HLXU4455667', '40HC', 'RELEASED', 'Aduana Buenaventura', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

-- Op 4
(uuid_generate_v4(), 'e5f6a7b8-0000-0000-0000-000000000004', 'EVER9988776', '40HC', 'LOADED', 'Terminal Shenzhen', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days'),

-- Op 5
(uuid_generate_v4(), 'f6a7b8c9-0000-0000-0000-000000000005', 'ZCSU5544332', '40RF', 'AT_PORT', 'Puerto de Santos', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days');

-- =============================================================================
-- 3. RUNS (Simulando ejecuciones de agentes)
-- =============================================================================
INSERT INTO runs (id, operation_id, agent_name, flow_step, status, context_json) VALUES
('11111111-0000-0000-0000-000000000000', 'c3d4e5f6-0000-0000-0000-000000000002', 'ARI', 'transit_monitor', 'COMPLETED', '{"messages":[]}'),
('22222222-0000-0000-0000-000000000000', 'f6a7b8c9-0000-0000-0000-000000000005', 'RECON', 'document_reconciliation', 'WAITING_INPUT', '{"messages":[]}');

-- =============================================================================
-- 4. EVENTS (Alertas)
-- =============================================================================
INSERT INTO events (id, operation_id, run_id, severity, category, title, message) VALUES
(uuid_generate_v4(), 'c3d4e5f6-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000000', 'CRITICAL', 'ETA_SLIP', 'Retraso Crítico de ETA', 'El contenedor CMAU9876543 ha sufrido un retraso de 7 días por congestión en Algeciras. Posible quiebre de stock.'),

(uuid_generate_v4(), 'd4e5f6a7-0000-0000-0000-000000000003', NULL, 'WARNING', 'CUSTOMS_DELAY', 'Retención en Aduana', 'El contenedor HLXU1122334 fue seleccionado para aforo físico. Retraso estimado: 48h.'),

(uuid_generate_v4(), 'e5f6a7b8-0000-0000-0000-000000000004', NULL, 'WARNING', 'MISSING_DOC', 'Documento Faltante', 'Falta el Bill of Lading (BL) para confirmar el zarpe. El buque sale en 48 horas.'),

(uuid_generate_v4(), 'f6a7b8c9-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000000', 'CRITICAL', 'DOCUMENT_DISCREPANCY', 'Discrepancia en Invoice vs Aduana', 'El valor declarado en la aduana ($40,000) no coincide con el Commercial Invoice ($45,000). Riesgo de multa aduanera.');

-- =============================================================================
-- 5. DECISIONS (Human-in-the-loop)
-- =============================================================================
INSERT INTO decisions (id, operation_id, run_id, action_type, title, description, severity, execution_mode, status, default_action, options_json) VALUES
-- Decisión para el ETA Slip
(uuid_generate_v4(), 'c3d4e5f6-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000000', 'REROUTE_SHIPMENT', 'Mitigar retraso de 7 días', 'Ari propone notificar al cliente final del retraso y buscar ruta aérea alternativa para el 20% de la carga más crítica.', 'CRITICAL', 'REQUIRE_APPROVAL', 'PENDING',
 '{"title": "Notificar cliente y cotizar aéreo", "payload": {"action": "quote_air_freight", "percent": 20}}',
 '[{"id":"opt1","title":"Aprobar plan de Ari","description":"Notifica y cotiza","impact_summary":"Mitiga quiebre de stock, costo extra ~$2,500"},
   {"id":"opt2","title":"Solo notificar","description":"Avisar sin cotizar aéreo","impact_summary":"Cero costo extra, alto riesgo de quiebre"},
   {"id":"opt3","title":"Ignorar","description":"Mantener curso actual","impact_summary":"Riesgo operativo"}]'),

-- Decisión para la discrepancia de documentos
(uuid_generate_v4(), 'f6a7b8c9-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000000', 'REQUEST_DOCUMENT_AMENDMENT', 'Resolver discrepancia de Invoice', 'El agente RECON detectó una diferencia de $5,000. Propone retener el trámite y pedir corrección al proveedor.', 'CRITICAL', 'REQUIRE_APPROVAL', 'PENDING',
 '{"title": "Solicitar corrección al proveedor", "payload": {"action": "email_supplier", "issue": "value_mismatch"}}',
 '[{"id":"opt1","title":"Enviar email al proveedor","description":"Solicitar nuevo Invoice por $40,000","impact_summary":"Retrasa despacho 24h, evita multa"},
   {"id":"opt2","title":"Forzar declaración con $45,000","description":"Pagar impuestos sobre el mayor valor","impact_summary":"Costos arancelarios extra, despacho inmediato"}]');
