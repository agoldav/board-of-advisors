import type { ReactNode } from "react";

const INLINE_RE =
  /(\*\*[^*]+\*\*|\$[\d][\d,.]*|\d[\d.,]*\s*%|₡[\d][\d,.]*)/g;

function formatInline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`${keyBase}-b-${i}`}>{token.slice(2, -2)}</strong>,
      );
    } else {
      parts.push(
        <span key={`${keyBase}-n-${i}`} className="advisor-highlight">
          {token}
        </span>,
      );
    }
    last = idx + token.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 72) return false;
  if (/^#{1,3}\s/.test(t)) return true;
  if (/^\d+\.\s+[A-ZÁÉÍÓÚ]/.test(t)) return false;
  if (/^[-•*]\s/.test(t)) return false;
  if (/[.!?]$/.test(t)) return false;
  if (t === t.toUpperCase() && /[A-ZÁÉÍÓÚ]/.test(t) && t.length < 48) return true;
  return /^[A-ZÁÉÍÓÚ][^.!?]{2,50}$/.test(t);
}

function stripHeadingMark(line: string): string {
  return line.replace(/^#{1,3}\s+/, "").trim();
}

export function AdvisorMessageBody({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const paragraphs = text.split(/\n{2,}/);

  paragraphs.forEach((para, pi) => {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const allBullets = lines.every((l) => /^[-•*]\s+/.test(l));
    const allNumbered = lines.every((l) => /^\d+[.)]\s+/.test(l));

    if (allBullets) {
      blocks.push(
        <ul key={`p-${pi}`} className="advisor-list">
          {lines.map((line, li) => (
            <li key={li}>{formatInline(line.replace(/^[-•*]\s+/, ""), `p${pi}l${li}`)}</li>
          ))}
        </ul>,
      );
      return;
    }

    if (allNumbered) {
      blocks.push(
        <ol key={`p-${pi}`} className="advisor-list">
          {lines.map((line, li) => (
            <li key={li}>
              {formatInline(line.replace(/^\d+[.)]\s+/, ""), `p${pi}n${li}`)}
            </li>
          ))}
        </ol>,
      );
      return;
    }

    if (lines.length === 1 && isHeadingLine(lines[0]!)) {
      blocks.push(
        <h3 key={`p-${pi}`} className="advisor-heading">
          {formatInline(stripHeadingMark(lines[0]!), `p${pi}h`)}
        </h3>,
      );
      return;
    }

    lines.forEach((line, li) => {
      const bullet = /^[-•*]\s+/.test(line);
      const numbered = /^\d+[.)]\s+/.test(line);
      const body = bullet
        ? line.replace(/^[-•*]\s+/, "")
        : numbered
          ? line.replace(/^\d+[.)]\s+/, "")
          : line;
      if (isHeadingLine(body) && !bullet && !numbered) {
        blocks.push(
          <h3 key={`p-${pi}-l-${li}`} className="advisor-heading">
            {formatInline(stripHeadingMark(body), `p${pi}lh${li}`)}
          </h3>,
        );
      } else if (bullet) {
        blocks.push(
          <ul key={`p-${pi}-l-${li}`} className="advisor-list advisor-list-single">
            <li>{formatInline(body, `p${pi}lb${li}`)}</li>
          </ul>,
        );
      } else {
        blocks.push(
          <p key={`p-${pi}-l-${li}`}>{formatInline(body, `p${pi}lp${li}`)}</p>,
        );
      }
    });
  });

  return <div className="advisor-formatted">{blocks}</div>;
}
