export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }
  const { supplier } = req.body || {};
  if (!supplier) {
    return res.status(400).json({ error: true, message: 'Missing supplier domain' });
  }

  let whoisData = '';
  try {
    const whois = await fetch('https://api.whoisjson.com/v1/' + supplier);
    const whoisJson = await whois.json();
    if (whoisJson.creation_date) whoisData = 'Domain registered: ' + whoisJson.creation_date + '. Registrar: ' + (whoisJson.registrar || 'unknown') + '.';
  } catch(e) {}

  try {
    const prompt = 'You are a professional supplier risk analyst. Analyze the supplier domain "' + supplier + '" for an Amazon FBA seller considering using them as a wholesale supplier.' +
    (whoisData ? ' WHOIS data: ' + whoisData : '') +
    ' Return ONLY valid JSON with this exact structure, no markdown: ' +
    '{"company_name":"","website":"' + supplier + '","address":"","domain_age":"","business_category":"","overall_score":5.0,' +
    '"verdict":"MODERATE RISK","verdict_summary":"2-3 sentence executive summary of the risk assessment",' +
    '"supplier_category":"What type of supplier this appears to be (e.g. legitimate wholesale distributor, dropshipping store, reseller, etc)",' +
    '"categories":[' +
    '{"name":"Domain Age Risk","score":5,"explanation":""},' +
    '{"name":"Fraud Scanner Risk","score":5,"explanation":""},' +
    '{"name":"Amazon Compliance Risk","score":5,"explanation":""},' +
    '{"name":"Review Quality Risk","score":5,"explanation":""},' +
    '{"name":"Transparency Risk","score":5,"explanation":""},' +
    '{"name":"Brand Authorization Risk","score":5,"explanation":""},' +
    '{"name":"Physical Presence Risk","score":5,"explanation":""}],' +
    '"red_flags":["specific red flag 1","specific red flag 2","specific red flag 3"],' +
    '"due_diligence_steps":["Step 1: specific action","Step 2: specific action","Step 3: specific action","Step 4: specific action","Step 5: specific action"],' +
    '"conclusion":"Clear final recommendation — DO NOT USE, USE WITH CAUTION, or SAFE TO PROCEED — with specific reasoning",' +
    '"safety_protocol":["Maximum test order amount if testing is required","How to verify invoice with Amazon","How to confirm brand authorization","Payment method recommendation","Physical verification requirement"],' +
    '"data_sources_note":""}';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: true, message: data?.error?.message || 'API error' });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message || 'Server error' });
  }
}
