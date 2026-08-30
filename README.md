# Maizena---Nextwave

## Realtime order incident demo

With the backend running on port 3001, raise an incident for every connected demo client:

```bash
curl -i -X POST http://localhost:3001/api/demo/incidents -H 'Content-Type: application/json' --data '{"orderId":"ORD-2046","type":"delay","severity":"critical","message":"Carrier reported a 48-hour delay"}'
```
