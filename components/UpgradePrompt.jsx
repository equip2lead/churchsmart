'use client';

import { getRequiredPlan } from '../lib/featureGating';

export default function UpgradePrompt({ feature, featureLabel, onNavigate }) {
  const requiredPlan = getRequiredPlan(feature);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '40px 20px'
    }}>
      <div style={{
        textAlign: 'center', maxWidth: '440px', backgroundColor: 'white',
        borderRadius: '20px', padding: '48px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          width: '64px', height: '64px', margin: '0 auto 20px',
          backgroundColor: '#eef2ff', borderRadius: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px'
        }}>
          🔒
        </div>
        <h2 style={{
          margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#1f2937'
        }}>
          {featureLabel}
        </h2>
        <p style={{
          margin: '0 0 24px', fontSize: '15px', color: '#6b7280', lineHeight: '1.6'
        }}>
          This feature is available on the <strong style={{ color: '#4f46e5' }}>{requiredPlan}</strong> plan and above.
          Upgrade to unlock it for your church.
        </p>
        <button
          onClick={() => onNavigate && onNavigate('settings')}
          style={{
            padding: '12px 32px', backgroundColor: '#4f46e5', color: 'white',
            border: 'none', borderRadius: '10px', fontSize: '15px',
            fontWeight: '600', cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
        >
          View Plans &amp; Upgrade
        </button>
      </div>
    </div>
  );
}
