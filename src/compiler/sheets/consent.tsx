import { ParsedItalic } from "@/utils/parse-italic";
import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";

export const Constent = () => {
  const { document, profile } = usePrintable();
  if (!document) return null;

  return (
    <section className="introduction page-break new-page">
      <h1 className="chapter" id="consent">
        LEMBAR PERSETUJUAN
      </h1>

      <h1 className="chapter">
        <ParsedItalic text={document.getDocument().title} />
      </h1>

      <div
        style={{
          marginTop: "1.5cm",
          textAlign: "center",
        }}
      >
        <h1 className="chapter">TUGAS AKHIR</h1>

        <div
          style={{
            fontSize: "13.5pt",
            marginBottom: "1.5cm",
            lineHeight: "16.2pt",
            marginTop: "1.5cm",
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

        <div style={{ textAlign: "center" }}>
          Telah diperiksa dan disetujui sebagai Laporan Tugas Akhir
          <br />
          di Pekanbaru, pada tanggal{" "}
          {formatDate(document.getDocument().config.consentDate!)}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              paddingTop: "5em",
              textAlign: "left",
            }}
          >
            <b>Ketua Program Studi</b>

            <br />
            <br />
            <br />
            <br />
            <br />
            <br />

            <span style={{ fontWeight: "bold" }}>
              Angraini, S.Kom., M.Eng., Ph.D.
            </span>

            <br />

            <span
              style={{
                fontWeight: "bold",
                paddingTop: "1px",
                display: "inline-block",
              }}
            >
              NIP. 198408212009012008
            </span>
          </div>

          <div
            style={{
              textAlign: "left",
              paddingTop: "5em",
            }}
          >
            <b>Pembimbing</b>

            <br />
            <br />
            <br />
            <br />
            <br />
            <br />

            <>
              <span style={{ fontWeight: "bold" }}>
                {profile?.advisorName}.
              </span>

              <br />

              <span
                style={{
                  fontWeight: "bold",
                  paddingTop: "1px",
                  display: "inline-block",
                }}
              >
                NIP. {profile?.advisorNip}
              </span>
            </>
          </div>
        </div>
      </div>
    </section>
  );
};
