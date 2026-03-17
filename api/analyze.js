export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  const rawSupplier = req.body?.supplier;
  if (!rawSupplier) {
    return res.status(400).json({ error: true, message: 'Missing supplier domain' });
  }

  // Normalize input like https://example.com/path -> example.com
  let supplier = rawSupplier
    .toString()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();

  let whoisData = '';
  try {
    const whois = await fetch('https://api.whoisjson.com/v1/' + supplier);
    const whoisJson = await whois.json();

    if (whoisJson.creation_date) {
      whoisData =
        'Domain registered: ' +
        whoisJson.creation_date +
        '. Registrar: ' +
        (whoisJson.registrar || 'unknown') +
        '.';
    }
  } catch (e) {
    console.error('WHOIS error:', e);
  }

  try {
    const prompt =
      'You are a professional supplier risk analyst for Amazon FBA sellers. ' +
      'Use your web search tool to research the supplier domain "' + supplier + '" before generating your report. ' +
      'Search for the company website, business registration, BBB listing, Trustpilot reviews, news articles, import records, and any fraud complaints. ' +
      (whoisData ? 'WHOIS data found: ' + whoisData + '. ' : '') +
      'Return ONLY valid JSON. No markdown. No commentary. No citations text outside the JSON. ' +
      '{"company_name":"","website":"' + supplier + '","address":"","domain_age":"","business_category":"","overall_score":5.0,' +
      '"verdict":"MODERATE RISK",' +
      '"verdict_summary":"2-3 sentence executive summary based on actual research findings",' +
      '"supplier_category":"What type of supplier this actually is based on research",' +
      '"categories":[' +
      '{"name":"Domain Age Risk","score":5,"explanation":"based on actual WHOIS or research data"},' +
      '{"name":"Fraud Scanner Risk","score":5,"explanation":"based on actual fraud database research"},' +
      '{"name":"Amazon Compliance Risk","score":5,"explanation":"based on actual Amazon compliance research"},' +
      '{"name":"Review Quality Risk","score":5,"explanation":"based on actual Trustpilot BBB research"},' +
      '{"name":"Transparency Risk","score":5,"explanation":"based on actual website research"},' +
      '{"name":"Brand Authorization Risk","score":5,"explanation":"based on actual brand authorization research"},' +
      '{"name":"Physical Presence Risk","score":5,"explanation":"based on actual address verification research"}],' +
      '"red_flags":["specific finding 1","specific finding 2","specific finding 3"],' +
      '"due_diligence_steps":["Step 1","Step 2","Step 3","Step 4","Step 5"],' +
      '"conclusion":"Clear final recommendation with specific evidence from research",' +
      '"safety_protocol":["Maximum test order if testing required","Invoice verification with Amazon","Brand authorization confirmation","Payment method recommendation","Physical verification requirement"],' +
      '"data_sources_note":"Sources researched during analysis"}';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
          },
        ],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: true,
        message: data?.error?.message || 'Anthropic API error',
        raw: data,
      });
    }

    // Extract final text blocks
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    if (!text) {
      return res.status(500).json({
        error: true,
        message: 'No text content returned from Anthropic',
        raw: data,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: true,
        message: 'Claude did not return valid JSON',
        raw_text: text,
        raw: data,
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({
      error: true,
      message: err.message || 'Server error',
    });
  }
}
