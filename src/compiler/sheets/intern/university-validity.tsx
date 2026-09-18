import { usePrintable } from "@/hooks/use-printable";
import { ParsedItalic } from "@/utils/parse-italic";
import { formatDate } from "@/utils/date";
import { name } from "@/utils/name";

export const UniversityConsent = () => {
  const { document, profile } = usePrintable();

  if (!document) return null;
  const doc = document.getDocument();

  const advisorName =
    doc.config.intern?.advisor?.name ||
    profile?.advisors?.[0]?.name ||
    profile?.advisorName ||
    "";

  const advisorNip =
    doc.config.intern?.advisor?.nip ||
    profile?.advisors?.[0]?.identity_number ||
    profile?.advisorNip ||
    "";

  const kaprodiName =
    doc.config.kaprodi?.name || "Angraini, S.Kom., M.Eng., Ph.D.";

  const kaprodiNip =
    doc.config.kaprodi?.nip || "198408212009012008";

  const validityDate = formatDate(
    doc.config.intern?.validity ??
      doc.config.validityDate ??
      doc.config.consentDate ??
      new Date(),
  );

  return (
    <section className="introduction page-break new-page">
      <h1
        className="chapter"
        id="univ-consent"
        style={{ textTransform: "uppercase" }}
      >
        Lembar Pengesahan Program Studi
      </h1>
      <h1 className="chapter">
        <ParsedItalic text={doc.title} />
      </h1>

      <div
        style={{
          marginTop: "1.2cm",
          textAlign: "center",
        }}
      >
        <h1 className="chapter">LAPORAN KERJA PRAKTEK</h1>

        <div
          style={{
            fontSize: "13.5pt",
            marginBottom: "0.8cm",
            lineHeight: "16.2pt",
            marginTop: "0.8cm",
          }}
        >
          Oleh:
          <br />
          <br />
          <div
            style={{
              textTransform: "uppercase",
              fontWeight: "bold",
              marginTop: ".3cm",
            }}
          >
            {profile?.name}
          </div>
          <div
            style={{
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            {profile?.nim}
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "0.8cm" }}>
          Telah diperiksa dan disetujui sebagai Laporan Kerja Praktek
          <br />
          di Pekanbaru, pada tanggal {validityDate}
        </div>

        {/* Dosen Pembimbing */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "0.8cm",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <b>Pembimbing Kerja Praktek</b>
            <div style={{ height: "1.8cm" }} />
            <span style={{ fontWeight: "bold" }}>
              {advisorName ? name(advisorName) : ""}
            </span>
            <br />
            <span
              style={{
                fontWeight: "bold",
                paddingTop: "1px",
                display: "inline-block",
              }}
            >
              NIP. {advisorNip}
            </span>
          </div>
        </div>

        {/* Kaprodi */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            Mengetahui,
            <br />
            <b>Ketua Program Studi Sistem Informasi</b>
            <br />
            Fakultas Sains dan Teknologi
            <br />
            Universitas Islam Negeri Sultan Syarif Kasim Riau
            <br />
            Pekanbaru, pada {validityDate}
            <div style={{ height: "1.8cm" }} />
            <span style={{ fontWeight: "bold" }}>
              {name(kaprodiName)}
            </span>
            <br />
            <span
              style={{
                fontWeight: "bold",
                paddingTop: "1px",
                display: "inline-block",
              }}
            >
              NIP. {kaprodiNip}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
