const listStyle = `
.foreword ol,
.page ol {
  list-style: none;
  margin-bottom: 6pt;
}

.foreword li,
.page li {
  position: relative;
  padding-left: 6pt;
}

.foreword li::before,
.page li::before {
  content: counter(list-item) ".";
  position: absolute;
  left: -1cm;
  width: 0.8cm;
  text-align: right;
}

.foreword li > ol li::before,
.page li > ol li::before {
  content: counter(list-item, lower-alpha) ".";
}

.foreword li > ol > li ol li::before,
.page li > ol > li ol li::before {
  content: counter(list-item) ")";
}

.foreword li::marker,
.page li::marker {
  content: "" !important;
}
`;

const baseStyle = `
${listStyle}

.page {
  width: 21cm;
  min-height: 29.7cm;
  background: #ffffff;
  padding: 3cm 3cm 4cm 4cm;
  font-family: 'Times New Roman', serif;
  font-size: 12pt;
  line-height: 1.5;
  box-sizing: border-box;
  position: relative;
  page-break-after: always;
  counter-reset: h1-counter var(--start-counter,0)
}

.page .tiptap > p {
  text-indent: 1.27cm;
  margin-top: 0;
  margin-bottom: 0.5em;
  text-align: justify;
}

.ProseMirror p {
  max-width: 14cm;
  text-align: justify;
  overflow-wrap: break-word;
}

.page > .tiptap {
  max-width: 14cm !important;
}

.tiptap {
  margin: 0;
  padding: 0;
  min-height: max-content;
}

.page li p {
  text-indent: 0;
}

.page ol {
  margin-left: 2.5em;
}

.page ul {
  list-style-type: disc;
  margin-left: 2.5em;
}

.page table {
  max-width: 14cm !important;
  border-bottom: 1px solid black;
  table-layout: fixed;
}

.page th,
.page td {
  text-align: left;
  padding-left: 0.2em;
  padding-right: 0.2em;
}

.page td {
  overflow-wrap: anywhere;
}

.page td > div {
  width: 100%;
}

.selectedCell::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.07);
  pointer-events: none;
  z-index: 2;
}

.page figure {
  margin-top: 7pt;
  margin-bottom: 7pt;
}

.page figure[data-type="imageFigure"] {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.page figure[data-type="figureTable"] {
  font-size: 10pt;
}

.page figcaption {
  text-align: center;
  margin-top: 5pt;
}

td.center p,
th.center p {
  text-align: center;
}

td.left p,
th.left p {
  text-align: left;
}

td.right p,
th.right p {
  text-align: right;
}

.tiptap pre {
  background: black;
  color: white;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
}

.tiptap code {
  background: none;
  font-size: 0.8rem;
}

.page-break {
  height: 20px;
  border-top: 1px dashed #ccc;
  margin: 10px 0;
}

.tiptap:focus {
  outline: none;
}

.page cite {
  font-style: normal;
}

.latex-var {
  position: relative;
  cursor: pointer;
}

.latex-var::before {
  content: "@var \\" attr(var);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s;
}

.latex-var:hover::before {
  opacity: 1;
}

.menu {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  z-index: 100;
}
`;

export const chapterStyle = `
${baseStyle}

.page h1 {
  font-size: 14pt;
  font-weight: 700;
  text-align: center;
  counter-reset: h2-counter h3-counter fig-counter caption-counter;
  counter-increment: h1-counter;
  margin: 10pt 0;
}

.page h1::before {
  content: "BAB " counter(h1-counter) "\\A";
  white-space: pre-line;
}


.page h2 {
  font-size: 12pt;
  font-weight: 600;
  counter-increment: h2-counter;
  counter-reset: h3-counter;
}

.page h2::before {
  content: counter(h1-counter) "." counter(h2-counter) ". ";
}

.page h3 {
  font-size: 12pt;
  font-weight: 600;
  counter-increment: h3-counter;
}

.page h3::before {
  content: counter(h1-counter) "." counter(h2-counter) "." counter(h3-counter) ". ";
}

.page figure[data-type="figureTable"] figcaption::before {
  content: "Tabel " counter(h1-counter) "." counter(caption-counter) ". ";
  font-weight: bold;
}

.page figcaption::before {
  content: attr(data-label) " ";
  font-weight: bold;
}
`;

export const nonChapterStyle = `
${baseStyle}

.page h1 {
  font-size: 14pt;
  font-weight: 700;
  text-align: center;
  margin: 10pt 0;
}

.page h2,
.page h3 {
  font-size: 12pt;
  font-weight: 600;
}

.page figcaption::before {
  content: "Gambar " counter(fig-counter) ". ";
}
`;
