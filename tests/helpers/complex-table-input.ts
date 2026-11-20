import type { JSONContent } from "@tiptap/core";

const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });

/** Small deterministic cases for the shared table planner, with no storage access. */
export function complexTableInput(kind: string): JSONContent[] {
  const sentence = "Pengukuran menjaga seluruh isi tabel dan urutan sumber tetap lengkap. ";
  const cell = (text: string, attrs = {}, header = false): JSONContent => ({
    type: header ? "tableHeader" : "tableCell", attrs, content: [p(text)],
  });
  const row = (...content: JSONContent[]): JSONContent => ({ type: "tableRow", content });
  const grid = (id: string, count: number): JSONContent => ({ type: "table", content: [
    row(cell(`Header ${id}`, {}, true)),
    ...Array.from({ length: count }, (_, index) => row(cell(`${id} ${index}. ${sentence}`))),
  ] });
  const figure = (id: string, table: JSONContent): JSONContent => ({ type: "figureTable", attrs: { id }, content: [
    { type: "figcaption", content: [{ type: "text", text: `Caption ${id}` }] }, table,
  ] });
  if (kind === "merged") return [p(sentence.repeat(6)), figure("merged", { type: "table", content: [
    row(cell("Kelompok", { rowspan: 2, colwidth: [100] }, true), cell("Pengukuran", { colspan: 2, colwidth: [160, 240] }, true)),
    row(cell("Awal", { colwidth: [160] }, true), cell("Akhir", { colwidth: [240] }, true)),
    row(cell(sentence.repeat(55), { rowspan: 3, colwidth: [100] }), cell("B1", { colwidth: [160] }), cell(sentence.repeat(7), { colwidth: [240] })),
    row(cell(sentence.repeat(4), { colspan: 2, colwidth: [160, 240] })),
    row(cell("B3", { colwidth: [160] }), cell("C3", { colwidth: [240] })),
    ...Array.from({ length: 12 }, (_, index) => row(cell(`A ${index}`), cell(`B ${index}`), cell(`C ${index}`))),
  ] }), p("MERGED-END")];
  if (kind === "adjacent-nested") return [figure("adjacent", { type: "table", content: [
    row(cell("Induk kiri", {}, true), cell("Induk kanan", {}, true)),
    row({ type: "tableCell", content: [p("Sebelum kiri"), figure("left", grid("L", 22)), p("Sesudah kiri")] },
      { type: "tableCell", content: [p("Sebelum kanan"), grid("R", 16), p("Sesudah kanan")] }),
    row(cell("Penutup kiri"), cell("Penutup kanan")),
  ] }), p("ADJACENT-END")];
  if (kind === "nested-header") {
    const header = cell(sentence.repeat(60), { colspan: 2 }, true);
    header.content!.push({ type: "horizontalRule" }, p("Header setelah forced break"));
    const inner = figure("inner-header", { type: "table", content: [row(header),
      ...Array.from({ length: 8 }, (_, index) => row(cell(`Kiri ${index}`), cell(`Kanan ${index}`))),
    ] });
    return [figure("outer-header", { type: "table", content: [
      row(cell("Header induk", {}, true)),
      row({ type: "tableCell", content: [p("Pembuka nested header"), inner, p("Penutup nested header")] }),
    ] }), p("NESTED-HEADER-END")];
  }
  throw Error(`Unknown complex table fixture: ${kind}`);
}

/** Shared cases for DOM fragmentation and native PDF verification. */
export function captionFlowInput(variant: string): JSONContent[] {
  if (["merged", "adjacent-nested", "nested-header"].includes(variant)) return complexTableInput(variant);
  if (variant === "image-only") return [{ type: "image", attrs: { src: "tall-fixture-image", width: 600 } }];
  const caption: JSONContent={type:'figcaption',content:[{type:'text',text:variant==='caption'||variant==='image'||variant==='nested'
    ? 'Caption lengkap '+('Uraian caption panjang dan harus tetap utuh. '.repeat(260)) : 'Caption pendek'}]};
  let contents: JSONContent[]=variant==='image'||variant==='image-short' ? [{type:'imageFigure',attrs:{id:'image'},content:[
    {type:'image',attrs:{src:'tall-fixture-image',width:600}},caption]}] : [{type:'figureTable',attrs:{id:'table'},content:[caption,
    {type:'table',content:Array.from({length:variant==='normal'?70:30},(_,i)=>({type:'tableRow',content:[0,1].map(j=>({
      type:i===0?'tableHeader':'tableCell',content:[p(i===0&&variant==='header'
        ? 'Header lengkap '+('Isi header yang harus dicetak lengkap. '.repeat(110)) : 'Sel '+i+' kolom '+j)]}))}))}]}];
  if(variant==='nested')contents=[{type:'figureTable',attrs:{id:'outer'},content:[
    {type:'figcaption',content:[{type:'text',text:'Tabel induk'}]},
    {type:'table',content:[
      {type:'tableRow',content:['Induk A','Induk B'].map(text=>({type:'tableHeader',content:[p(text)]}))},
      {type:'tableRow',content:[
        {type:'tableCell',attrs:{rowspan:2},content:[p('Sebelum tabel anak.'),...contents,p('Sesudah tabel anak.')]},
        {type:'tableCell',content:[p('Tetangga baris pertama.')]}
      ]},
      {type:'tableRow',content:[{type:'tableCell',content:[p('Tetangga baris kedua.')]}]}
    ]}
  ]}];
  return contents;
}
