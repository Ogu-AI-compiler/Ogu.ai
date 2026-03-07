interface Props {
  balance: number;
  onAddCredits?: () => void;
}

export function CreditBalance({ balance, onAddCredits }: Props) {
  const isLow = balance < 10;

  return (
    <div
      style={{
        background: "var(--bg-card)", border: `1px solid ${isLow ? "var(--danger, #ef4444)" : "var(--border)"}`,
        borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Credit Balance</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: isLow ? "var(--danger, #ef4444)" : "var(--text)" }}>
          {balance.toLocaleString()}
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>credits</span>
        </div>
        {isLow && (
          <div style={{ fontSize: 12, color: "var(--danger, #ef4444)", marginTop: 4 }}>Low balance — add credits to continue</div>
        )}
      </div>
      {onAddCredits && (
        <button
          onClick={onAddCredits}
          style={{
            padding: "8px 16px", background: "var(--accent)", color: "var(--color-accent-text)", border: "none",
            borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          + Add Credits
        </button>
      )}
    </div>
  );
}
