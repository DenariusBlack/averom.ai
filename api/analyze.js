export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `You are Averom's AI Supplier Risk Intelligence Engine — a specialized analyst for Amazon sellers evaluating wholesale and B2B suppliers.

Your job is to analyze a supplier's website and generate a structured risk intelligence report based on your knowledge. Assess the supplier using publicly known information about the domain, business reputation patterns, and industry signals.

ANALYSIS METHODOLOGY:
Consider the following data points when generating the report:
1. Domain characteristics — is it a well-known domain? Does the name suggest legitimacy or raise concerns?
2. Business reputation patterns — are there commonly known complaints, scam reports, or fraud indicators associated with this type of supplier?
3. Amazon compliance signals — is the supplier likely an authorized distributor, or does it show grey market signals?
4. Review and social proof patterns — what would you expect for a legitimate supplier of this type?
5. Transparency indicators — does the business name suggest transparency or opacity?
6. Brand authorization likelihood — can you assess whether they are likely authorized to sell the brands they claim?
7. Physical presence expectations — what would you expect for a supplier in this category?

SCORING METHODOLOGY:
Each risk category is scored 0–10 where:
0–2 = Low risk (verified, established)
3–5 = Moderate risk (some gaps)
6–8 = High risk (significant red flags)
9–10 = Critical risk (strong fraud indicators)

Risk categories and their weight in the overall score:
- Domain Age Risk (15%): Unknown or suspicious domain characteristics = higher risk
- Fraud Scanner Risk (20%): Known scam complaints, fraud reports, unresolved disputes
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

Return ONLY valid JSON with these fields: company_name, website, address, domain_age, business_category, overall_score, verdict, verdict_summary, supplier_category, categories (array of 7 risk scores), red_flags, due_diligence_steps, conclusion, safety_protocol, data_sources_note.

IMPORTANT RULES:
- If you don't have specific knowledge about a supplier, state that clearly and assign moderate-to-high scores reflecting the uncertainty.
- Red flags must be specific and actionable, not generic.
- Due diligence steps must be practical for an Amazon seller with no legal team.
- The conclusion must give a clear go/no-go signal with conditions if applicable.
- If the domain does not appear to be a real supplier, return a CRITICAL RISK score with appropriate explanation.`;

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[analyze:${requestId}] Request received`, req.method, new Date().toISOString());

  // CORS headers on every response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { supplier } = req.body || {};
    if (!supplier) {
      return res.status(400).json({ error: 'Supplier domain is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(`[analyze:${requestId}] ANTHROPIC_API_KEY not set`);
      return res.status(500).json({ error: 'API key not configured', details: 'Server misconfiguration' });
    }

    console.log(`[analyze:${requestId}] Calling Anthropic for: ${supplier}`);
    const startTime = Date.now();

    // 50s safety timeout — abort before Vercel's 60s hard limit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let anthropicRes;
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analyze this supplier domain and generate a risk intelligence report as JSON: ${supplier}`,
            },
          ],
        }),
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        console.error(`[analyze:${requestId}] Anthropic call aborted after 50s`);
        return res.status(504).json({
          error: 'Analysis timed out',
          details: 'The AI took too long to respond. Please try again.',
        });
      }
      throw fetchErr;
    }

    clearTimeout(timeout);
    console.log(`[analyze:${requestId}] Anthropic responded in ${Date.now() - startTime}ms, status: ${anthropicRes.status}`);

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error(`[analyze:${requestId}] Anthropic error:`, data.error);
      return res.status(502).json({
        error: data.error?.message || 'AI service error',
        details: `Anthropic API returned status ${anthropicRes.status}`,
      });
    }

    const textBlocks = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[analyze:${requestId}] No JSON in AI response, got:`, textBlocks.slice(0, 200));
      return res.status(500).json({
        error: 'No structured report returned',
        details: 'The AI response did not contain valid JSON. Please try again.',
      });
    }

    let report;
    try {
      report = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error(`[analyze:${requestId}] JSON parse failed:`, parseErr.message);
      return res.status(500).json({
        error: 'Failed to parse AI report',
        details: 'The AI returned malformed JSON. Please try again.',
      });
    }

    console.log(`[analyze:${requestId}] Success, total time: ${Date.now() - startTime}ms`);
    return res.status(200).json(report);
  } catch (err) {
    console.error(`[analyze:${requestId}] Unhandled error:`, err.message);
    return res.status(500).json({
      error: 'Internal server error',
      details: err.message,
    });
  }
}
