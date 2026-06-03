import { ParsedItalic } from "@/utils/parse-italic";
import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";
import { format } from "date-fns";
import React from "react";

const getOrdinalSuffix = (dayStr: string) => {
  const day = parseInt(dayStr, 10);
  if (isNaN(day)) return "";
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const AbstractIndonesian = () => {
  const { document, profile } = usePrintable();
  const nextDoc = document?.getDocument();
  if (!nextDoc) return null;
  const { title, config, keywords } = nextDoc;

  return (
    <section className="new-page introduction">
      <h1
        style={{
          pageBreakBefore: "always",
          fontSize: "14pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: "0.7cm",
        }}
        className="pra-title"
      >
        <ParsedItalic text={title} />
      </h1>

      <div
        style={{
          textAlign: "center",
          fontSize: "14pt",
          fontWeight: "bold",
          textTransform: "uppercase",
        }}
      >
        {profile?.name}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: "14pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          marginBottom: "0.7cm",
        }}
      >
        NIM:
        {profile?.nim}
      </div>

      <div
        style={{
          marginBottom: "0.7cm",
          fontSize: "12pt",
          lineHeight: "14.4pt",
        }}
      >
        <p style={{ textAlign: "center" }}>
          Tanggal Sidang : {formatDate(config.statementDate)}
        </p>

        <p style={{ textAlign: "center" }}>
          Periode Wisuda :
          <span style={{ display: "inline-block", width: "120pt" }}>
            &nbsp;
          </span>
        </p>
      </div>

      <div
        style={{
          marginBottom: "0.7cm",
          fontSize: "12pt",
          lineHeight: "14.4pt",
        }}
      >
        <p style={{ textAlign: "center" }}>Program Studi Sistem Informasi</p>
        <p style={{ textAlign: "center" }}>Fakultas Sains dan Teknologi</p>
        <p style={{ textAlign: "center" }}>
          Universitas Islam Negeri Sultan Syarif Kasim Riau
        </p>
        <p style={{ textAlign: "center" }}>
          Jl. Soebrantas, No. 155, Pekanbaru
        </p>
      </div>

      <h1
        id="abstract-id"
        style={{
          textAlign: "center",
          fontSize: "12pt",
          marginBottom: "0.7cm",
          marginTop: "1.5cm",
        }}
      >
        ABSTRAK
      </h1>

      <div
        className="abstract-id"
        style={{ textAlign: "justify", fontSize: "12pt", lineHeight: "1.5" }}
      ></div>
      <p style={{ marginTop: "1em" }}>
        <b>Kata Kunci: </b>{" "}
        {keywords.indonesian.map((k, i) => (
          <React.Fragment key={i}>
            <ParsedItalic text={k} />
            {i !== keywords.english.length - 1 && ", "}
          </React.Fragment>
        ))}
      </p>
    </section>
  );
};
export const AbstractEnglish = () => {
  const { document, profile } = usePrintable();
  const nextDoc = document?.getDocument();
  if (!nextDoc) return null;
  const { title, config, keywords, altTitle } = nextDoc;

  const safeDate = config.statementDate || new Date();
  const date = format(safeDate, "MMMM dd yyyy");
  const d = date.split(" ")[1];
  const ordinal = getOrdinalSuffix(d);

  return (
    <section
      className="new-page introduction italic"
      style={{ fontStyle: "italic" }}
    >
      <h1
        style={{
          pageBreakBefore: "always",
          fontSize: "14pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: "0.7cm",
          fontStyle: "italic",
        }}
        className="pra-title"
      >
        {altTitle || title}
      </h1>

      <div
        style={{
          textAlign: "center",
          fontSize: "14pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          fontStyle: "normal",
        }}
      >
        {profile?.name}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: "14pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          marginBottom: "0.7cm",
          fontStyle: "normal",
        }}
      >
        NIM:
        {profile?.nim}
      </div>

      <div
        style={{
          marginBottom: "0.7cm",
          fontSize: "12pt",
          lineHeight: "14.4pt",
        }}
      >
        {
          <p style={{ textAlign: "center", fontStyle: "italic" }}>
            Date of Final Exam: {format(safeDate, "MMMM dd")}
            <sup>{ordinal}</sup> {format(safeDate, "yyyy")}
          </p>
        }
        <p style={{ textAlign: "center", fontStyle: "italic" }}>
          Graduation Period:
          <span style={{ display: "inline-block", width: "120pt" }}>
            &nbsp;
          </span>
        </p>
      </div>

      <div
        style={{
          marginBottom: "0.7cm",
          fontSize: "12pt",
          lineHeight: "14.4pt",
        }}
      >
        <p style={{ textAlign: "center", fontStyle: "italic" }}>
          Department of Information System
        </p>
        <p style={{ textAlign: "center", fontStyle: "italic" }}>
          Faculty of Science and Technology
        </p>
        <p style={{ textAlign: "center", fontStyle: "italic" }}>
          State Islamic University of Sultan Syarif Kasim Riau
        </p>
        <p style={{ textAlign: "center", fontStyle: "italic" }}>
          Soebrantas Street, No. 155, Pekanbaru
        </p>
      </div>

      <h1
        id="abstract-en"
        style={{
          textAlign: "center",
          fontSize: "12pt",
          marginBottom: "0.7cm",
          marginTop: "1.5cm",
        }}
      >
        ABSTRACT
      </h1>

      <div
        className="abstract-en"
        style={{
          textAlign: "justify",
          fontSize: "12pt",
          lineHeight: "1.5",
          fontStyle: "italic",
        }}
      >
        {/* {abstractEn && (
                    <div dangerouslySetInnerHTML={{ __html: abstractEn }} />
                )} */}
        {/* {keywords?.english && (
                    <p style={{ marginTop: '1em' }}>
                        <b>Keywords: </b>
                        <span dangerouslySetInnerHTML={{ __html: keywords.english }} />
                    </p>
                )} */}
      </div>
      <p style={{ marginTop: "1em" }}>
        <b>Keywords: </b>{" "}
        {keywords.english.map((k, i) => (
          <span key={i}>
            {k}
            {i !== keywords.english.length - 1 && ", "}
          </span>
        ))}
      </p>
    </section>
  );
};
