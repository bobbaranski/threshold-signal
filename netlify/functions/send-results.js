// Netlify serverless function: send-results
// Receives assessment scores, sends personalized email via Resend, submits to Mailchimp

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { name, email, scores } = JSON.parse(event.body);
    // scores = { revenue: 3, decision: 2, strategy: 4, systems: 1, resilience: 3 }

    const totalScore = scores.revenue + scores.decision + scores.strategy + scores.systems + scores.resilience;

    // Determine readiness level
    let readinessLevel, readinessDesc;
    if (totalScore >= 20) {
      readinessLevel = 'CEO-Ready';
      readinessDesc = "You've made significant progress in the transition. Your constraints are refinement, not fundamental shifts. The signal here is about optimization — finding the last structural gaps that separate strong from exceptional.";
    } else if (totalScore >= 15) {
      readinessLevel = 'CEO-Emerging';
      readinessDesc = "You're in the transition — some areas are strong, but 2–3 key gaps are limiting your next phase of growth. The signal is clear: specific structural changes will unlock significant capacity.";
    } else if (totalScore >= 10) {
      readinessLevel = 'Founder-Dependent';
      readinessDesc = "The business runs through you — decisions, delivery, and direction all flow from one point. Growth is structurally limited until that changes. The question isn't whether to shift, but what to shift first.";
    } else {
      readinessLevel = 'Founder-Trapped';
      readinessDesc = "You're fully embedded in operations. The CEO transition hasn't begun yet, and growth is constrained at every level. The good news: clarity on where to start changes everything.";
    }

    // Find primary constraint (lowest score, first one wins ties)
    const dimensions = [
      { key: 'revenue', label: 'Revenue Leverage', score: scores.revenue },
      { key: 'decision', label: 'Decision Rights', score: scores.decision },
      { key: 'strategy', label: 'Strategic Focus', score: scores.strategy },
      { key: 'systems', label: 'Systems & Scalability', score: scores.systems },
      { key: 'resilience', label: 'Founder Resilience', score: scores.resilience }
    ];

    const primaryConstraint = dimensions.reduce((min, d) => d.score < min.score ? d : min, dimensions[0]);

    // Pre-written constraint analysis blocks
    const constraintAnalysis = {
      revenue: {
        analysis: "Your revenue is tightly coupled to your personal involvement. This means growth is capped by your available hours — no matter how hard you work, there's a ceiling. The business can't scale beyond what you can personally deliver.",
        firstMove: "Identify one current service or offering that could be packaged, grouped, or partially automated to reduce your direct 1:1 involvement. You don't need to rebuild your model — start with one offer and test it with 3 existing clients. The goal: prove that value can be delivered without your hands on every engagement.",
        metric: "Within 30 days, have one offering that reduces your per-client time by at least 30%."
      },
      decision: {
        analysis: "Decisions still funnel through you — your team checks in on things they should own. This creates a bottleneck that slows everything: response times, execution speed, and your own capacity for strategic thinking. The company has outgrown its decision architecture.",
        firstMove: "Map every decision you made this week into three categories: Founder-Only, Needs Approval, and Team-Owned. Then pick one category of decisions you're currently making and formally hand it to a team member with clear boundaries. Not a task — a decision category with the authority to act.",
        metric: "Within 30 days, reduce your weekly decision load by 25% through clear delegation of one decision category."
      },
      strategy: {
        analysis: "You're spending the vast majority of your time in the business — delivery, troubleshooting, firefighting — with little protected time to work on it. The strategic questions that would unlock your next phase of growth keep getting pushed aside by operational urgency.",
        firstMove: "Block 4 hours per week for strategic work — non-negotiable, recurring, protected. Then identify the top operational escalation path that pulls you away from strategy most often and build a system to handle it without you. The goal isn't to do more — it's to create space for the thinking that matters most.",
        metric: "Within 30 days, maintain 4 protected strategic hours per week for 3 consecutive weeks."
      },
      systems: {
        analysis: "Critical business processes exist primarily in your head. New team members can't ramp without extensive shadowing, and if you're unavailable, things break. Growth is limited by reproducibility — scaling currently requires cloning you.",
        firstMove: "Identify the one process you do weekly that takes the most time and would have the highest impact if someone else could run it. Document it — not perfectly, just enough that someone competent could follow it. Then train one person to run it and refine the documentation based on their questions.",
        metric: "Within 30 days, have one critical weekly process running independently with documentation."
      },
      resilience: {
        analysis: "You're approaching or at personal capacity limits. The pace isn't sustainable, and without support infrastructure — advisors, peers, leadership bench — the risk compounds. A founder at capacity can't think strategically, and the business suffers as a result.",
        firstMove: "Identify 2 people in your network who are 2–3 steps ahead of where you are and schedule conversations with them in the next two weeks. Not to ask for help — to get perspective. Then assess your leadership bench: who on your team could step up if you needed to step back for 30 days?",
        metric: "Within 30 days, have 2 advisory conversations completed and a written assessment of leadership bench strength."
      }
    };

    const constraint = constraintAnalysis[primaryConstraint.key];

    // Build score bar HTML for email
    function scoreBar(label, score) {
      const pct = (score / 5) * 100;
      let color;
      if (score >= 4) color = '#3a7d5c';
      else if (score === 3) color = '#c17f3e';
      else color = '#a94442';

      return `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 500; color: #5a5a72; width: 160px; vertical-align: middle;">${label}</td>
          <td style="padding: 8px 0; vertical-align: middle;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td style="width: 85%;">
                  <div style="background: #f0ece4; border-radius: 4px; height: 8px; width: 100%;">
                    <div style="background: ${color}; border-radius: 4px; height: 8px; width: ${pct}%;"></div>
                  </div>
                </td>
                <td style="width: 15%; text-align: right; padding-left: 12px;">
                  <span style="font-size: 14px; font-weight: 700; color: ${color};">${score}/5</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    // Assemble the email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf8f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              <p style="font-size: 12px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: #c17f3e; margin: 0 0 16px 0;">Uplift Growth Strategies</p>
              <h1 style="font-size: 32px; font-weight: 400; color: #1a1a2e; margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif;">Your Threshold Signal Results</h1>
              <p style="font-size: 16px; color: #5a5a72; margin: 0;">${name}, here's what your assessment revealed.</p>
            </td>
          </tr>

          <!-- Score Card -->
          <tr>
            <td style="background: white; border-radius: 12px; border: 1px solid #e2ddd5; padding: 32px; margin-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #e2ddd5;">
                    <p style="font-size: 48px; font-weight: 400; color: #1a1a2e; margin: 0; font-family: Georgia, 'Times New Roman', serif;">${totalScore}<span style="font-size: 22px; color: #8a8a9a;"> / 25</span></p>
                    <p style="font-size: 22px; color: #1a1a2e; margin: 8px 0 0 0; font-family: Georgia, 'Times New Roman', serif;">${readinessLevel}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="font-size: 15px; color: #5a5a72; line-height: 1.7; margin: 0;">${readinessDesc}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height: 24px;"></td></tr>

          <!-- Dimension Scores -->
          <tr>
            <td style="background: white; border-radius: 12px; border: 1px solid #e2ddd5; padding: 32px;">
              <p style="font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8a8a9a; margin: 0 0 20px 0;">Your Signal by Dimension</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${scoreBar('Revenue Leverage', scores.revenue)}
                ${scoreBar('Decision Rights', scores.decision)}
                ${scoreBar('Strategic Focus', scores.strategy)}
                ${scoreBar('Systems & Scalability', scores.systems)}
                ${scoreBar('Founder Resilience', scores.resilience)}
              </table>
            </td>
          </tr>

          <tr><td style="height: 24px;"></td></tr>

          <!-- Primary Constraint -->
          <tr>
            <td style="background: white; border-radius: 12px; border: 1px solid #e2ddd5; padding: 32px;">
              <p style="font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #a94442; margin: 0 0 12px 0;">Your Primary Constraint</p>
              <h2 style="font-size: 22px; font-weight: 400; color: #1a1a2e; margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif;">${primaryConstraint.label}</h2>
              <p style="font-size: 15px; color: #5a5a72; line-height: 1.7; margin: 0;">${constraint.analysis}</p>
            </td>
          </tr>

          <tr><td style="height: 24px;"></td></tr>

          <!-- Recommended First Move -->
          <tr>
            <td style="background: white; border-radius: 12px; border: 1px solid #e2ddd5; padding: 32px;">
              <p style="font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #3a7d5c; margin: 0 0 12px 0;">Recommended First Move</p>
              <p style="font-size: 15px; color: #5a5a72; line-height: 1.7; margin: 0 0 16px 0;">${constraint.firstMove}</p>
              <p style="font-size: 14px; color: #1a1a2e; font-weight: 600; margin: 0; padding: 16px; background: #f0ece4; border-radius: 8px;">Target: ${constraint.metric}</p>
            </td>
          </tr>

          <tr><td style="height: 24px;"></td></tr>
<!-- Guide Download -->
          <tr>
            <td style="background: white; border-radius: 12px; border: 1px solid #e2ddd5; padding: 32px; text-align: center;">
              <p style="font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #c17f3e; margin: 0 0 12px 0;">Go Deeper on Your Score</p>
              <h2 style="font-size: 22px; font-weight: 400; color: #1a1a2e; margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif;">The Founder's Threshold Guide</h2>
              <p style="font-size: 15px; color: #5a5a72; line-height: 1.7; margin: 0 0 20px 0;">What your score reveals about the next 12 months — and the structural shifts that change the trajectory. Five dimensions. Five patterns. The one that matters most for you.</p>
              <a href="https://sprightly-gingersnap-0eb7cb.netlify.app/founders-threshold-guide.pdf" style="display: inline-block; background: #c17f3e; color: white; padding: 14px 36px; border-radius: 6px; font-size: 15px; font-weight: 600; text-decoration: none;">Download the Guide (PDF)</a>
            </td>
          </tr>

          <tr><td style="height: 24px;"></td></tr>
          <!-- CTA -->
          <tr>
            <td style="background: #1a1a2e; border-radius: 12px; padding: 40px; text-align: center;">
              <h2 style="font-size: 22px; font-weight: 400; color: #faf8f5; margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif;">Want to Go Deeper?</h2>
              <p style="font-size: 15px; color: rgba(250, 248, 245, 0.7); margin: 0 0 24px 0; line-height: 1.6;">The Threshold Signal shows you where the constraint lives. The Founder's Threshold is a structured 2-hour executive diagnostic that uncovers the root cause and builds a prioritized 90-day roadmap to address it.</p>
              <a href="https://calendly.com/bob-baranski-upliftgrowthstrategies/30min" style="display: inline-block; background: #c17f3e; color: white; padding: 14px 36px; border-radius: 6px; font-size: 15px; font-weight: 600; text-decoration: none;">Book a Fit Call</a>
            </td>
          </tr>

          <tr><td style="height: 32px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding-top: 24px; border-top: 1px solid #e2ddd5;">
              <p style="font-size: 13px; color: #8a8a9a; margin: 0;">© 2026 Uplift Growth Strategies</p>
              <p style="font-size: 13px; color: #8a8a9a; margin: 8px 0 0 0;">This email was sent because you completed The Threshold Signal assessment.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // --- Send email via Resend ---
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // Send to founder
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Uplift Growth Strategies <results@upliftgrowthstrategies.com>',
        to: [email],
        bcc: ['bob.baranski@upliftgrowthstrategies.com'],
        subject: `${name}, Your Threshold Signal Results`,
        html: emailHtml
      })
    });

    const resendData = await resendResponse.json();
    console.log('Resend response:', resendData);

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to send email', details: resendData })
      };
    }

    // --- Submit to Mailchimp ---
    const scoreString = name + ' - R' + scores.revenue 
      + '.D' + scores.decision 
      + '.St' + scores.strategy 
      + '.Sy' + scores.systems 
      + '.Re' + scores.resilience 
      + '.T' + totalScore;

    const mailchimpUrl = 'https://upliftgrowthstrategies.us4.list-manage.com/subscribe/post-json?u=96ce718700bfda66e7f14644a&id=13a4133e04&f_id=00f25ee2f0'
      + '&EMAIL=' + encodeURIComponent(email)
      + '&FNAME=' + encodeURIComponent(scoreString);

    try {
      await fetch(mailchimpUrl);
    } catch (mcError) {
      // Mailchimp submission is best-effort — don't fail the whole request
      console.error('Mailchimp error (non-fatal):', mcError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Email sent successfully' })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
