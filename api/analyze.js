const SYSTEM_PROMPT = `You are Averom's AI Supplier Risk Intelligence Engine. Analyze the supplier domain provided and generate a structured risk intelligence report based on your knowledge of the domain, company signals, and industry patterns. SCORING: Each category 0-10. 0-2=Low, 3-5=Moderate, 6-8=High, 9-10=Critical. Categories and weights: - Domain Age Risk (15%) - Fraud Scanner Risk (20%) - Amazon Compliance Risk (15%) - Review Quality Risk (15%) - Transparency Risk (20%) - Brand Authorization Risk (10%) - Physical Presence Risk (5%) VERDICT: 0-2.9=LOW RISK, 3-5.9=MODERATE RISK, 6-7.9=HIGH RISK, 8-10=CRITICAL RISK Respond ONLY with valid JSON, no markdown, no preamble: { "company_name": "string", "website": "string", "address": "string", "domain_age": "string", "business_category": "string", "overall_score": number, "verdict": "LOW RISK | MODERATE RISK | HIGH RISK | CRITICAL RISK", "verdict_summary": "string", "categories": [ {"name": "Domain Age Risk", "score": number, "explanation": "string"}, {"name": "Fraud Scanner Risk", "score": number, "explanation": "string"}, {"name": "Amazon Compliance Risk", "score": number, "explanation": "string"}, {"name": "Review Quality Risk", "score": number, "explanation": "string"}, {"name": "Transparency Risk", "score": number, "explanation": "string"}, {"name": "Brand Authorization Risk", "score": number, "explanation": "string"}, {"name": "Physical Presence Risk", "score": number, "explanation": "string"} ], "red_flags": ["string"], "due_diligence_steps": ["string"], "conclusion": "string", "data_sources_note": "string" }`;

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: true, message: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    const body = await req.json();
    const supplier = body.supplier;

    if (!supplier) {
      return new Response(
        JSON.stringify({ error: true, message: 'Supplier domain is required' }),
        { status: 400, headers }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: true, message: 'API key not configured' }),
        { status: 500, headers }
      );
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Analyze this supplier and generate a full risk intelligence report: ${supplier}`,
          },
        ],
      }),
    });

    let data;
    try {
      data = await anthropicRes.json();
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ error: true, message: 'Anthropic API returned invalid response' }),
        { status: 502, headers }
      );
    }

    if (!anthropicRes.ok) {
      return new Response(
        JSON.stringify({ error: true, message: data.error?.message || 'Anthropic API error' }),
        { status: 500, headers }
      );
    }

    const textBlocks = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const cleaned = textBlocks.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: true, message: 'No report generated', raw: textBlocks.slice(0, 200) }),
        { status: 500, headers }
      );
    }

    let report;
    try {
      report = JSON.parse(jsonMatch[0]);
    } catch (jsonErr) {
      return new Response(
        JSON.stringify({ error: true, message: 'Failed to parse AI response as JSON', raw: jsonMatch[0].slice(0, 200) }),
        { status: 500, headers }
      );
    }

    return new Response(JSON.stringify(report), { status: 200, headers });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: true, message: err.message || 'Internal server error' }),
      { status: 500, headers }
    );
  }
}
