export interface DocumentContent {
  fileName: string;
  operationReference: string;
  documentType: string;
  rawText: string;
}

export const HELD_OUT_DOCUMENTS: DocumentContent[] = [
  // --- Operation 1: PO-2026-9101 (Clean - Shenzhen Electronics) ---
  {
    fileName: '01_Purchase_Order_PO-2026-9101.txt',
    operationReference: 'PO-2026-9101',
    documentType: 'PURCHASE_ORDER',
    rawText: `================================================================================
PURCHASE ORDER / ORDEN DE COMPRA
================================================================================
PO Number: PO-2026-9101
Date: 2026-08-25
Buyer / Consignee: Electrónica Global de México S.A. de C.V.
Supplier / Shipper: Shenzhen Apex Electronics Co., Ltd., High-Tech Park, Nanshan, Shenzhen, China
Incoterm: FOB Shenzhen
Port of Loading: Shenzhen Port, China
Port of Discharge: Puerto de Manzanillo, Colima, Mexico
Payment Terms: T/T 30 Days

Line Items:
Item 1: 4K Industrial Display Panels - Model APX-4K | Qty: 200 units | Unit Price: 500.00 USD | Total: 100,000.00 USD
Item 2: High-Speed Microcontrollers - Model MCU-88 | Qty: 850 pieces | Unit Price: 50.00 USD | Total: 42,500.00 USD

Total Purchase Order Value: 142,500.00 USD
Requested Shipment Date: 2026-09-05
Authorized by: Director de Compras Internacionales
================================================================================`,
  },
  {
    fileName: '02_Booking_Confirmation_COSU9101001.txt',
    operationReference: 'PO-2026-9101',
    documentType: 'BOOKING_CONFIRMATION',
    rawText: `================================================================================
COSCO SHIPPING LINES - BOOKING CONFIRMATION
================================================================================
Booking Ref: COSU9101001
Carrier: COSCO Shipping Lines
Shipper: Shenzhen Apex Electronics Co., Ltd.
Consignee: Electrónica Global de México S.A. de C.V.
Operation Reference: PO-2026-9101
Vessel / Voyage: COSCO HARMONY / 118W
Port of Loading: Shenzhen Port, China (Yantian Terminal)
Port of Discharge: Puerto de Manzanillo, Colima, Mexico
Estimated Time of Departure (ETD): 2026-09-05
Estimated Time of Arrival (ETA): 2026-09-24
Equipment: 1 x 40HC High Cube Container
Commodity: Industrial Display Panels & Microcontrollers
================================================================================`,
  },
  {
    fileName: '03_Bill_of_Lading_COSCOBL9101001.txt',
    operationReference: 'PO-2026-9101',
    documentType: 'BILL_OF_LADING',
    rawText: `================================================================================
COSCO SHIPPING LINES - OCEAN BILL OF LADING
================================================================================
B/L No: COSCOBL9101001
Booking Ref: COSU9101001
Carrier: COSCO Shipping Lines
Shipper: Shenzhen Apex Electronics Co., Ltd., Shenzhen, China
Consignee: Electrónica Global de México S.A. de C.V., CDMX, México
Notify Party: Agente Aduanal Manzanillo Logistics S.C.
Vessel / Voyage: COSCO HARMONY / 118W
Port of Loading: Shenzhen Port, China
Port of Discharge: Puerto de Manzanillo, Colima, Mexico

Container Number: COSU9182734
Seal Number: COS991827
Container Type: 40HC
Packages: 350 Cartons
Cargo Description: 4K Industrial Display Panels and Microcontrollers
Gross Weight: 14,800.00 KG (14800 kg)
Measurement: 58.40 CBM
Freight: Freight Prepaid
Shipped on Board Date: 2026-09-05
================================================================================`,
  },
  {
    fileName: '04_Packing_List_PL-2026-9101.txt',
    operationReference: 'PO-2026-9101',
    documentType: 'PACKING_LIST',
    rawText: `================================================================================
PACKING LIST / LISTA DE EMPAQUE
================================================================================
Packing List No: PL-2026-9101
Invoice Ref: INV-2026-9101
PO Reference: PO-2026-9101
B/L Reference: COSCOBL9101001
Date: 2026-09-03
Shipper: Shenzhen Apex Electronics Co., Ltd.
Consignee: Electrónica Global de México S.A. de C.V.
Container Number: COSU9182734
Seal Number: COS991827

Package Details:
Cartons 001 - 200: 4K Industrial Display Panels (200 units)
Cartons 201 - 350: High-Speed Microcontrollers (850 pieces)

Total Packages: 350 Cartons
Total Net Weight: 13,650.00 KG
Total Gross Weight: 14,800.00 KG (14800 kg)
Total Declared Value: 142,500.00 USD
================================================================================`,
  },

  // --- Operation 2: PO-2026-9202 (Clean - Chittagong Garments) ---
  {
    fileName: '01_Purchase_Order_PO-2026-9202.txt',
    operationReference: 'PO-2026-9202',
    documentType: 'PURCHASE_ORDER',
    rawText: `================================================================================
PURCHASE ORDER / ORDEN DE COMPRA
================================================================================
PO Number: PO-2026-9202
Date: 2026-08-28
Buyer: Uniformes y Calzado Industrial de México
Supplier: Bengal Garments & Apparel Ltd., Agrabad, Chittagong, Bangladesh
Incoterm: FOB Chittagong
Port of Loading: Chittagong Port, Bangladesh
Port of Discharge: Puerto de Veracruz, Mexico

Line Items:
Item 1: Cotton Work Uniform Sets | Qty: 1200 sets | Unit Price: 45.00 USD | Total: 54,000.00 USD
Item 2: Safety Steel-Toe Boots | Qty: 700 pairs | Unit Price: 49.857 USD | Total: 34,900.00 USD

Total Purchase Order Value: 88,900.00 USD
Requested Shipment Date: 2026-09-12
================================================================================`,
  },
  {
    fileName: '02_Booking_Confirmation_ONEBK9202.txt',
    operationReference: 'PO-2026-9202',
    documentType: 'BOOKING_CONFIRMATION',
    rawText: `================================================================================
OCEAN NETWORK EXPRESS (ONE) - BOOKING CONFIRMATION
================================================================================
Booking Ref: ONEBK9202
Carrier: Ocean Network Express (ONE)
Shipper: Bengal Garments & Apparel Ltd.
Consignee: Uniformes y Calzado Industrial de México
Operation Reference: PO-2026-9202
Vessel / Voyage: ONE APUS / 007E
Port of Loading: Chittagong Port, Bangladesh
Port of Discharge: Puerto de Veracruz, Mexico
ETD: 2026-09-12
ETA: 2026-10-08
Equipment: 1 x 40HC Container
================================================================================`,
  },
  {
    fileName: '03_Bill_of_Lading_ONEBL9202002.txt',
    operationReference: 'PO-2026-9202',
    documentType: 'BILL_OF_LADING',
    rawText: `================================================================================
OCEAN NETWORK EXPRESS (ONE) - BILL OF LADING
================================================================================
B/L No: ONEBL9202002
Carrier: Ocean Network Express (ONE)
Shipper: Bengal Garments & Apparel Ltd., Chittagong, Bangladesh
Consignee: Uniformes y Calzado Industrial de México, Veracruz, México
Vessel: ONE APUS
Port of Loading: Chittagong Port, Bangladesh
Port of Discharge: Puerto de Veracruz, Mexico

Container Number: ONEU7738192
Seal Number: ONE008219
Container Type: 40HC
Packages: 720 Packages
Cargo Description: Cotton Work Uniforms and Safety Industrial Footwear
Gross Weight: 21,400.00 KG (21400 kg)
Shipped on Board Date: 2026-09-12
================================================================================`,
  },
  {
    fileName: '04_Packing_List_PL-2026-9202.txt',
    operationReference: 'PO-2026-9202',
    documentType: 'PACKING_LIST',
    rawText: `================================================================================
PACKING LIST / LISTA DE CONTENIDO
================================================================================
Packing List Ref: PL-2026-9202
PO Reference: PO-2026-9202
B/L Reference: ONEBL9202002
Shipper: Bengal Garments & Apparel Ltd.
Consignee: Uniformes y Calzado Industrial de México
Container Number: ONEU7738192
Seal Number: ONE008219
Total Packages: 720 Packages
Net Weight: 19,800.00 KG
Gross Weight: 21,400.00 KG (21400 kg)
Total Invoice Amount: 88,900.00 USD
================================================================================`,
  },

  // --- Operation 3: PO-2026-9303 (Discrepancy: Weight mismatch) ---
  {
    fileName: '01_Purchase_Order_PO-2026-9303.txt',
    operationReference: 'PO-2026-9303',
    documentType: 'PURCHASE_ORDER',
    rawText: `================================================================================
PURCHASE ORDER / ORDEN DE COMPRA
================================================================================
PO Number: PO-2026-9303
Buyer: Maquinados y Troqueles del Bajío
Supplier: Busan Heavy Machinery Corp., Gangseo-gu, Busan, South Korea
Incoterm: FOB Busan
Port of Loading: Busan Port, South Korea
Port of Discharge: Puerto de Lázaro Cárdenas, Michoacán, Mexico
Item: Hydraulic CNC Milling Centers - Model HMC-5000 | Qty: 3 units | Unit Price: 65,000 USD | Total: 195,000.00 USD
Requested Shipment Date: 2026-09-18
================================================================================`,
  },
  {
    fileName: '02_Booking_Confirmation_HDMUBK9303.txt',
    operationReference: 'PO-2026-9303',
    documentType: 'BOOKING_CONFIRMATION',
    rawText: `================================================================================
HMM CO., LTD. - BOOKING CONFIRMATION
================================================================================
Booking Ref: HDMUBK9303
Carrier: HMM Co., Ltd.
Shipper: Busan Heavy Machinery Corp.
Consignee: Maquinados y Troqueles del Bajío
Operation Reference: PO-2026-9303
Vessel / Voyage: HYUNDAI BRAVE / 088E
Port of Loading: Busan Port, South Korea
Port of Discharge: Puerto de Lázaro Cárdenas, Michoacán, Mexico
ETD: 2026-09-18
ETA: 2026-10-06
Equipment: 1 x 40HC Container
================================================================================`,
  },
  {
    fileName: '03_Bill_of_Lading_HDMUBL9303003.txt',
    operationReference: 'PO-2026-9303',
    documentType: 'BILL_OF_LADING',
    rawText: `================================================================================
HMM CO., LTD. - BILL OF LADING
================================================================================
B/L No: HDMUBL9303003
Carrier: HMM Co., Ltd.
Shipper: Busan Heavy Machinery Corp., Busan, South Korea
Consignee: Maquinados y Troqueles del Bajío, Querétaro, México
Vessel: HYUNDAI BRAVE
Port of Loading: Busan Port, South Korea
Port of Discharge: Puerto de Lázaro Cárdenas, Michoacán, Mexico

Container Number: HDMU4491028
Seal Number: HDM993012
Packages: 12 Wooden Crates
Cargo Description: 3 Units Hydraulic CNC Milling Centers
Gross Weight: 26,500.00 KG (26500 kg)
Shipped on Board Date: 2026-09-18
================================================================================`,
  },
  {
    fileName: '04_Packing_List_PL-2026-9303_DISCREPANCY.txt',
    operationReference: 'PO-2026-9303',
    documentType: 'PACKING_LIST',
    rawText: `================================================================================
PACKING LIST / LISTA DE EMPAQUE (DISCREPANCY VERSION)
================================================================================
Packing List Ref: PL-2026-9303
PO Reference: PO-2026-9303
B/L Reference: HDMUBL9303003
Shipper: Busan Heavy Machinery Corp.
Consignee: Maquinados y Troqueles del Bajío
Container Number: HDMU4491028
Total Crates: 12 Wooden Crates
Net Weight: 22,500.00 KG
Gross Weight: 24,100.00 KG (24100 kg)  <-- NOTE: Declares 24,100 kg while B/L declares 26,500 kg!
Total Commercial Value: 195,000.00 USD
================================================================================`,
  },

  // --- Operation 4: PO-2026-9404 (Discrepancy: Container Number Mismatch) ---
  {
    fileName: '01_Purchase_Order_PO-2026-9404.txt',
    operationReference: 'PO-2026-9404',
    documentType: 'PURCHASE_ORDER',
    rawText: `================================================================================
PURCHASE ORDER / ORDEN DE COMPRA
================================================================================
PO Number: PO-2026-9404
Buyer: Polímeros Industriales del Norte S.A.
Supplier: Antwerp Chemical Synthetics NV, Haven 1025, Antwerp, Belgium
Incoterm: CIF Altamira
Port of Loading: Port of Antwerp, Belgium
Port of Discharge: Puerto de Altamira, Tamaulipas, Mexico
Item: High-Density Polyethylene Pellets | Qty: 500 bags (25kg ea) | Unit Price: 230.00 USD | Total: 115,000.00 USD
Requested Shipment Date: 2026-09-08
================================================================================`,
  },
  {
    fileName: '03_Bill_of_Lading_HLCUBL9404004.txt',
    operationReference: 'PO-2026-9404',
    documentType: 'BILL_OF_LADING',
    rawText: `================================================================================
HAPAG-LLOYD - BILL OF LADING
================================================================================
B/L No: HLCUBL9404004
Carrier: Hapag-Lloyd
Shipper: Antwerp Chemical Synthetics NV, Antwerp, Belgium
Consignee: Polímeros Industriales del Norte S.A., Monterrey, México
Vessel: ROTTERDAM EXPRESS
Port of Loading: Port of Antwerp, Belgium
Port of Discharge: Puerto de Altamira, Tamaulipas, Mexico

Container Number: HLCU8819203
Seal Number: HLP009182
Packages: 500 Bags on Pallets
Gross Weight: 22,000.00 KG (22000 kg)
Shipped on Board Date: 2026-09-08
================================================================================`,
  },
  {
    fileName: '04_Packing_List_PL-2026-9404_DISCREPANCY.txt',
    operationReference: 'PO-2026-9404',
    documentType: 'PACKING_LIST',
    rawText: `================================================================================
PACKING LIST / LISTA DE EMPAQUE (DISCREPANCY VERSION)
================================================================================
Packing List Ref: PL-2026-9404
PO Reference: PO-2026-9404
B/L Reference: HLCUBL9404004
Shipper: Antwerp Chemical Synthetics NV
Consignee: Polímeros Industriales del Norte S.A.
Container Number: HLCU8819208  <-- NOTE: Typo in container number 'HLCU8819208' vs B/L 'HLCU8819203'
Gross Weight: 22,000.00 KG
Net Weight: 21,500.00 KG
Total Value: 115,000.00 USD
================================================================================`,
  },

  // --- Operation 5: PO-2026-9505 (Missing Field: Missing Destination Port) ---
  {
    fileName: '01_Purchase_Order_PO-2026-9505_MISSING_PORT.txt',
    operationReference: 'PO-2026-9505',
    documentType: 'PURCHASE_ORDER',
    rawText: `================================================================================
PURCHASE ORDER / ORDEN DE COMPRA (INCOMPLETE)
================================================================================
PO Number: PO-2026-9505
Buyer: Cafés Finos de Mesoamérica
Supplier: Santos Specialty Coffee Exporters SA, Santos, Brazil
Incoterm: FOB Santos
Port of Loading: Port of Santos, Brazil
Port of Discharge: [DESTINATION PORT NOT SPECIFIED - REQUIRES CONFIRMATION]
Item: Arabica Green Coffee Bags | Qty: 320 bags | Unit Price: 240.00 USD | Total: 76,800.00 USD
Requested Shipment Date: 2026-09-14
================================================================================`,
  },
  {
    fileName: '03_Bill_of_Lading_MSCUBL9505005.txt',
    operationReference: 'PO-2026-9505',
    documentType: 'BILL_OF_LADING',
    rawText: `================================================================================
MEDITERRANEAN SHIPPING COMPANY (MSC) - BILL OF LADING
================================================================================
B/L No: MSCUBL9505005
Carrier: Mediterranean Shipping Company (MSC)
Shipper: Santos Specialty Coffee Exporters SA, Santos, Brazil
Consignee: Cafés Finos de Mesoamérica
Vessel: MSC AGRIPPINO
Port of Loading: Port of Santos, Brazil
Port of Discharge: [PENDING CUSTOMER ASSIGNMENT]

Container Number: MSCU3391024
Seal Number: MSC881920
Packages: 320 Bags
Gross Weight: 19,200.00 KG
Shipped on Board Date: 2026-09-14
================================================================================`,
  },

  // --- Operation 6: PO-2026-9606 (Alternative Layout: German DIN 5008 Layout) ---
  {
    fileName: '01_Purchase_Order_PO-2026-9606_DIN5008.txt',
    operationReference: 'PO-2026-9606',
    documentType: 'PURCHASE_ORDER',
    rawText: `Bavaria Automotive Components GmbH · Industriestraße 45 · 80331 München · Germany

BESTELLUNG / PURCHASE ORDER PO-2026-9606
Datum / Date: 26. August 2026

Empfänger / Buyer: Autopartes Alemanas de Puebla, Parque Industrial Finsa, Puebla, Mexiko
Lieferant / Supplier: Bavaria Automotive Components GmbH
Lieferbedingung / Incoterm: FOB Hamburg Port, Germany
Bestimmungsort / Destination: Puerto de Veracruz, Mexico

POS | ARTIKEL / DESCRIPTION                  | MENGE | EINZELPREIS | GESAMTPREIS
--------------------------------------------------------------------------------
01  | Hochdruck-Kraftstoffpumpen / Fuel Pumps| 400 St| 420,00 USD  | 168.000,00 USD

Gesamtbetrag / Total FOB USD: 168.000,00 USD (168000 USD)
Voraussichtlicher Versandtermin / Shipping Date: 10.09.2026
================================================================================`,
  },
  {
    fileName: '03_Bill_of_Lading_CMAUBL9606006.txt',
    operationReference: 'PO-2026-9606',
    documentType: 'BILL_OF_LADING',
    rawText: `================================================================================
CMA CGM - BILL OF LADING / CONNAISSEMENT
================================================================================
B/L No: CMAUBL9606006
Carrier: CMA CGM
Shipper: Bavaria Automotive Components GmbH, Munich, Germany
Consignee: Autopartes Alemanas de Puebla, Puebla, Mexico
Vessel: CMA CGM MONTMARTRE
Port of Loading: Port of Hamburg, Germany
Port of Discharge: Puerto de Veracruz, Mexico

Container: CMAU5591028 / 40HC
Seal: CMA771829
Packages: 400 Cases
Cargo: 400 Units High-Pressure Automotive Fuel Pumps
Bruttogewicht / Gross Weight: 16,400.00 KG (16400 kg)
Date of Issue: 2026-09-10
================================================================================`,
  },
];
