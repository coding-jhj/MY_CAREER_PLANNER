type Props = { onRetry: () => void };
export function ErrorMessage({ onRetry }: Props) { return <section className="error" role="alert"><p>정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p><button className="secondary" type="button" onClick={onRetry} aria-label="대시보드 다시 불러오기">다시 시도</button></section>; }
