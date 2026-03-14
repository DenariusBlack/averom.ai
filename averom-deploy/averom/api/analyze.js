export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are Averom's AI Supplier Risk Intelligence Engine — a specialized analyst for Amazon sellers evaluating wholesale and B2B suppliers.

Your job is to analyze a supplier's website and generate a structured risk intelligence report. Use your web search capability to gather real data: domain registration, business presence, reviews, complaints, BBB records, social proof, Amazon policy signals, and any fraud indicators.

ANALYSIS METHODOLOGY:
Search for the following data points before generating the report:
1. WHOIS / domain age data for the supplier domain
2. Business name + "reviews" OR "complaints" OR "scam" OR "fraud"
3. Business name + "BBB" OR "Better Business Bureau"
4. Business name + "Amazon" OR "authorized distributor"
5. Physical address verification (Google Maps, LinkedIn, state business registry)
6. Social media presence and account age
7. Any news articles, legal filings, or forum discussions

SCORING METHODOLOGY:
Each risk category is scored 0–10 where:
0–2 = Low risk (verified, established)
3–5 = Moderate risk (some gaps)
6–8 = High risk (significant red flags)
9–10 = Critical risk (strong fraud indicators)

Risk categories and their weight in the overall score:
- Domain Age Risk (15%): Domain under 1 year = high risk
- Fraud Scanner Risk (20%): Scam complaints, fraud reports, unresolved disputes
- Amazon Compliance Risk (15%): Not an authorized distributor, grey market signals
- Review Quality Risk (15%): Fake reviews, no reviews, extreme negative patterns
- Transparency Risk (20%): Hidden ownership, no physical address, vague about info
- Brand Authorization Risk (10%): Cannot verify they are authorized to sell the brands they claim
- Physical Presence Risk (5%): No verifiable warehouse, office, or business registration

OVERALL SCORE = weighted average of all category scores, rounded to one decimal.

VERDICT LABELS:
0.0–2.9 = LOW RISK — Proceed with standard due diligence
3.0–5.9 = MODERATE RISK — Proceed with caution, verify key areas
6.0–7.9 = HIGH RISK — Do not proceed without extensive verification
8.0–10.0 = CRITICAL RISK — Strong fraud indicators, do not engage

OUTPUT FORMAT:
Respond ONLY with a valid JSON object. No preamble, no markdown, no explanation outside the JSON. Structure:

{
  "company_name": "string",
  "website": "string",
  "address": "string or 'Not publicly disclosed'",
  "domain_age": "string (e.g. '2 years, 3 months' or 'Registered 2022-04-11')",
  "business_category": "string",
  "overall_score": number (0.0–10.0),
  "verdict": "LOW RISK | MODERATE RISK | HIGH RISK | CRITICAL RISK",
  "verdict_summary": "2–3 sentence plain-English summary of why this score was assigned",
  "categories": [
    { "name": "Domain Age Risk", "score": number, "explanation": "string" },
    { "name": "Fraud Scanner Risk", "score": number, "explanation": "string" },
    { "name": "Amazon Compliance Risk", "score": number, "explanation": "string" },
    { "name": "Review Quality Risk", "score": number, "explanation": "string" },
    { "name": "Transparency Risk", "score": number, "explanation": "string" },
    { "name": "Brand Authorization Risk", "score": number, "explanation": "string" },
    { "name": "Physical Presence Risk", "score": number, "explanation": "string" }
  ],
  "red_flags": ["string", "string"],
  "due_diligence_steps": ["string", "string"],
  "conclusion": "string (2–4 sentences final assessment and recommendation)",
  "data_sources_note": "string (brief note on what data was found/not found)"
}

IMPORTANT RULES:
- Never fabricate data. If you cannot find information on a category, state that clearly in the explanation and assign a moderate-to-high score reflecting the lack of transparency.
- Red flags must be specific and actionable, not generic.
- Due diligence steps must be practical for an Amazon seller with no legal team.
- The conclusion must give a clear go/no-go signal with conditions if applicable.
- If the domain does not appear to be a real supplier or the site does not exist, return a CRITICAL RISK score with appropriate explanation.`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { supplier } = await req.json();
    if (!supplier) {
      return new Response(JSON.stringify({ error: 'Supplier domain is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `Analyze this supplier and generate a full risk intelligence report: ${supplier}`,
          },
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Anthropic API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const textBlocks = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'No structured report returned from AI' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const report = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
