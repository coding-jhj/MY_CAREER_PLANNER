type Props = { label: string; value: number; onClick: () => void; active: boolean };
export function MetricButton({ label, value, onClick, active }: Props) { return <button className="metric-button" type="button" onClick={onClick} aria-pressed={active} aria-label={`${label} ${value}개 필터 적용`}><span>{label}</span><span className="metric-number">{value}</span></button>; }
