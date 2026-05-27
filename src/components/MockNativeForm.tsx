import * as React from 'react';
import { FL } from './flTokens';
import { usePreviewSize } from './previewSize';

interface FieldRowProps {
  label: string;
  value: string;
  required?: boolean;
  suffix?: string;
  /** When true, label sits above the value instead of beside it (compact mode). */
  stacked?: boolean;
}

function FieldRow({ label, value, required, suffix, stacked }: FieldRowProps): React.ReactElement {
  if (stacked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ color: FL.fgMuted, fontSize: 12 }}>
          {label}
          {required && <span style={{ color: '#A80000', marginLeft: 6 }}>*</span>}
        </div>
        <div style={{
          minHeight: 30, borderRadius: 4, background: FL.fieldBg,
          color: value === '---' ? FL.fgSubtle : FL.fg2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', fontSize: 13, minWidth: 0,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
          {suffix && <span style={{ color: FL.fgMuted, marginLeft: 8 }}>{suffix}</span>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 38%) minmax(0, 1fr)', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <div style={{ color: FL.fg, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
        {required && <span style={{ color: '#A80000', marginLeft: 6 }}>*</span>}
      </div>
      <div style={{
        minHeight: 30, borderRadius: 4, background: FL.fieldBg,
        color: value === '---' ? FL.fgSubtle : FL.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px', fontSize: 13, minWidth: 0,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        {suffix && <span style={{ color: FL.fgMuted, marginLeft: 8 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section
      style={{
        background: FL.cardBg,
        border: `1px solid ${FL.stroke}`,
        borderRadius: 8,
        boxShadow: FL.shadow,
        padding: '12px 14px 14px',
        minWidth: 0,
      }}
    >
      <h3 style={{ margin: '0 0 18px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: FL.fg }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>{children}</div>
    </section>
  );
}

function Timeline({ stacked }: { stacked: boolean }): React.ReactElement {
  return (
    <SectionCard title="Timeline">
      <div style={{ height: 32, borderRadius: 4, background: FL.fieldBg, color: FL.fgMuted, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13 }}>
        Search Timeline
      </div>
      {[['Phone Call', 'Overdue'], ['Phone Call', 'Closed']].map(([title, state]) => (
        <div key={`${title}-${state}`} style={{ border: `1px solid ${FL.stroke}`, borderRadius: 8, padding: 10, boxShadow: FL.shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13, color: FL.fg }}>{title}</strong>
            <span style={{ borderRadius: 10, background: state === 'Overdue' ? '#FDE7E9' : FL.fieldBg, padding: '1px 8px', fontSize: 11, color: FL.fg2 }}>
              {state}
            </span>
          </div>
          <div style={{ marginTop: 8, color: FL.fg2, fontSize: 12, lineHeight: 1.35 }}>
            {stacked
              ? 'Call back to capture preliminary customer details.'
              : 'Call back to understand the problem. Capture preliminary customer details and create follow-up activities.'}
          </div>
          <div style={{ marginTop: 6, color: FL.fgMuted, fontSize: 12 }}>Modified on: 3 minutes ago</div>
        </div>
      ))}
    </SectionCard>
  );
}

function RelatedColumn({ stacked }: { stacked: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <SectionCard title="Primary Contact">
        <div style={{ background: '#EBF3FC', color: FL.brandDark, padding: '5px 8px', borderRadius: 4, fontSize: 12 }}>
          Paul Cannon (sample)
        </div>
        <FieldRow label="Email" value="someone_h@example.com" suffix="M" stacked={stacked} />
        <FieldRow label="Business" value="555-0107" suffix="P" stacked={stacked} />
      </SectionCard>
      <SectionCard title="Contacts">
        {['Patrick Sands (sample)', 'Paul Cannon (sample)'].map((name, index) => (
          <div key={name} style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: index ? `1px solid ${FL.stroke}` : undefined, paddingTop: index ? 10 : 0, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: index ? '#A4262C' : '#498205', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
              {index ? 'PC' : 'PS'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: FL.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: 11, color: FL.fgMuted }}>someone@example.com</div>
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

export function MockNativeForm(): React.ReactElement {
  const { mode } = usePreviewSize();

  // Column template adapts to mode. min(100%, X) prevents overflow when the
  // container is narrower than X.
  const templateColumns =
    mode === 'wide'    ? 'minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, .8fr)'
    : mode === 'regular' ? 'minmax(0, 1fr) minmax(0, 1fr)'
    : 'minmax(0, 1fr)';

  const stacked = mode === 'compact';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: templateColumns,
        gap: 10,
        alignItems: 'start',
        minWidth: 0,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <SectionCard title="Account Information">
          <FieldRow label="Account Name" value="Alpine Ski House (sample)" required stacked={stacked} />
          <FieldRow label="Phone" value="555-0157" suffix="P" stacked={stacked} />
          <FieldRow label="Fax" value="---" stacked={stacked} />
          <FieldRow label="Website" value="http://www.alpineskihouse.co..." suffix="W" stacked={stacked} />
          <FieldRow label="Parent Account" value="Look for Parent Account" suffix="Q" stacked={stacked} />
        </SectionCard>
        <SectionCard title="Address">
          <FieldRow label="Address 1: Street 1" value="2313 B Southampton Rd" stacked={stacked} />
          <FieldRow label="Address 1: Street 2" value="---" stacked={stacked} />
          <FieldRow label="Address 1: City" value="Missoula" stacked={stacked} />
        </SectionCard>
      </div>
      {/* In regular mode Timeline gets its own column and RelatedColumn drops below the first column.
          We achieve this by ordering: column 2 = Timeline, then RelatedColumn full-width. */}
      {mode === 'regular' ? (
        <>
          <Timeline stacked={stacked} />
          <div style={{ gridColumn: '1 / -1' }}>
            <RelatedColumn stacked={stacked} />
          </div>
        </>
      ) : (
        <>
          <Timeline stacked={stacked} />
          <RelatedColumn stacked={stacked} />
        </>
      )}
    </div>
  );
}
