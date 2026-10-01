/*
 * TradingAgents web dashboard: a small markdown renderer for agent reports.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Agent output is model-written text, so it is never injected as HTML: this
 * builds React elements for the subset the agents write (headings, paragraphs,
 * lists, tables, rules, bold, italic, inline code) and React escapes the rest.
 * The SAMPLE marker becomes a visible tag wherever it appears.
 */
import { Fragment } from 'react';
import { SAMPLE_MARKER } from '../data/adapter.js';

export function SampleTag({ children = 'SAMPLE — illustrative, not real analysis' }) {
  return <span className="sample-tag">{children}</span>;
}

function inline(text, keyBase = 'i') {
  const out = [];
  let rest = String(text);
  let k = 0;
  const re = /(\*\*[^*]+?\*\*|`[^`]+?`|(?<![\w*])\*[^*\s][^*]*?\*(?!\w)|(?<!\w)_[^_\s][^_]*?_(?!\w))/;
  while (rest.length) {
    const sample = rest.indexOf(SAMPLE_MARKER);
    const m = rest.match(re);
    const mIdx = m ? m.index : -1;
    if (sample !== -1 && (mIdx === -1 || sample <= mIdx)) {
      if (sample > 0) out.push(...inline(rest.slice(0, sample), `${keyBase}p${k++}`));
      out.push(<SampleTag key={`${keyBase}s${k++}`} />);
      rest = rest.slice(sample + SAMPLE_MARKER.length).replace(/^\s+/, ' ');
      continue;
    }
    if (!m) { out.push(rest); break; }
    if (mIdx > 0) out.push(rest.slice(0, mIdx));
    const tok = m[0];
    const key = `${keyBase}${k++}`;
    if (tok.startsWith('**')) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    rest = rest.slice(mIdx + tok.length);
  }
  return out;
}

export function Inline({ text }) {
  return <>{inline(text)}</>;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function parseBlocks(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ t: 'h', level: h[1].length, text: h[2] }); i += 1; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push({ t: 'hr' }); i += 1; continue; }
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (m) { items.push(m[2]); i += 1; continue; }
        if (lines[i].trim() && /^\s{2,}/.test(lines[i])) { items[items.length - 1] += ` ${lines[i].trim()}`; i += 1; continue; }
        break;
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s/.test(lines[i])
      && !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
      && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ t: 'p', lines: para });
  }
  return blocks;
}

export default function Markdown({ text, className = '' }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`md ${className}`}>
      {blocks.map((b, n) => {
        const key = `b${n}`;
        if (b.t === 'h') {
          const Tag = b.level <= 2 ? 'h4' : 'h5';
          return <Tag key={key}>{inline(b.text, key)}</Tag>;
        }
        if (b.t === 'hr') return <hr key={key} />;
        if (b.t === 'table') {
          return (
            <div className="md-table" key={key} role="region" aria-label="Table" tabIndex={0}>
              <table>
                <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, x) => <td key={x}>{inline(c, `${key}r${j}${x}`)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        if (b.t === 'ul' || b.t === 'ol') {
          const Tag = b.t;
          return <Tag key={key}>{b.items.map((it, j) => <li key={j}>{inline(it, `${key}l${j}`)}</li>)}</Tag>;
        }
        return (
          <p key={key}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}{inline(l, `${key}p${j}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
