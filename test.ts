//@ts-ignore
import Cite, { plugins } from "citation-js";
import fs from "fs";
import path from "path";

// Load XML Bahasa Indonesia Anda
const xml = fs.readFileSync(
  path.join(__dirname, "src/assets/locales-id-ID.xml"),
  "utf8",
);
const config = plugins.config.get("@csl");
config.locales.add("id-ID", xml);

// Data dengan 2 penulis untuk memicu kata sambung
const dataUji = new Cite([
  {
    id: "tes-harvard",
    type: "book",
    title: "Panduan Pengembangan Aplikasi Desktop",
    author: [
      { given: "Jef", family: "Okta" },
      { given: "Iwan", family: "Kurniawan" },
    ],
    issued: { "date-parts": [["2026"]] },
    publisher: "Tech Press",
  },
  {
    id: "tes-harvard",
    type: "article",
    title: "testing app",
    author: [{ given: "Jefy", family: "Okta Mipa" }],
    issued: { "date-parts": [["2015"]] },
    publisher: "Tech Press",
  },
]);

const outputIndonesia = dataUji.format("bibtex", {
  template: "bibtex",
  lang: "id-ID",
  format: "text",
});
console.log(outputIndonesia);

const System = {
  print: {
    out(...args: any) {
      console.log(...args);
    },
  },
};

System.print.out("Hello World");
