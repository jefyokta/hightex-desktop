import { ParsedItalic } from "@/utils/parse-italic";
import { HTMLAttributes } from "react";
import { usePrintable } from "@/hooks/use-printable";
import logo from "@/assets/images/logo-uin.png";

export const Cover = ({ ...props }: HTMLAttributes<any>) => {
  const { document, profile } = usePrintable();
  if (!document) return null;

  const doc = document.getDocument();

  return (
    <section
      id="cover"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        height: "22.7cm",
        textAlign: "center",
      }}
      className="cover"
      {...props}
    >
      {" "}
      <div>
        <div
          style={{
            fontSize: "14pt",
            fontWeight: "bold",
            textTransform: "uppercase",
            lineHeight: "16.8pt",
            marginBottom: "1.5cm",
          }}
        >
          <ParsedItalic text={doc.title} />
        </div>

        <div
          style={{
            fontSize: "16pt",
            fontWeight: "bold",
            textTransform: "uppercase",
            lineHeight: "19.2pt",
            marginBottom: "1.5cm",
          }}
        >
          Tugas akhir
        </div>

        <div
          id="sel"
          style={{
            fontSize: "11pt",
            marginBottom: "1.5cm",
            lineHeight: "13.2pt",
          }}
        >
          Diajukan Sebagai Salah Satu Syarat
          <br />
          untuk Memperoleh Gelar Sarjana Sistem Informasi pada
          <br />
          Program Studi Sistem Informasi
        </div>

        <div
          style={{
            fontSize: "13.5pt",
            marginBottom: "1cm",
            lineHeight: "16.2pt",
          }}
        >
          <div style={{ marginBottom: "1cm" }}>Oleh:</div>

          <span
            id="cover-author"
            className="cover-author"
            style={{
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            {profile?.name}
          </span>

          <br />

          <span
            style={{
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            {profile?.nim}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <img
          src={logo}
          alt="uin-suska"
          style={{
            width: "5.2cm",
            height: "5.2cm",
          }}
        />
      </div>
      <div
        style={{
          fontSize: "13.5pt",
          textTransform: "uppercase",
          fontWeight: "bold",
        }}
      >
        FAKULTAS SAINS DAN TEKNOLOGI
        <br />
        UNIVERSITAS ISLAM NEGERI SULTAN SYARIF KASIM RIAU PEKANBARU
        <br />
        {new Date().getFullYear()}
      </div>
    </section>
  );
};
