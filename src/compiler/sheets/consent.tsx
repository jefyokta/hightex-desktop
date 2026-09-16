import { ParsedItalic } from "@/utils/parse-italic";
import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";
import { name } from "@/utils/name";

export const Constent = () => {
  const { document, profile } = usePrintable();
  if (!document) return null;

  const SingleAdvisor = () => {
    return <div
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

        <span style={{
          fontWeight: "bold", textDecoration: "underline",
          textUnderlineOffset: "2pt",
        }}>
          {name(
            document.getDocument().config.kaprodi?.name ||
            "Angraini, S.Kom., M.Eng., Ph.D.",
          )}
        </span>

        <br />

        <span
          style={{
            fontWeight: "bold",
            paddingTop: "1px",
            display: "inline-block",
          }}
        >
          NIP.{" "}
          {document.getDocument().config.kaprodi?.nip ||
            "198408212009012008"}
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
          <span
            style={{
              fontWeight: "bold",
              textDecoration: "underline",
              textUnderlineOffset: "2pt",
            }}
          >
            {profile && profile.advisorName && name(profile?.advisorName)}
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

  }

  const DoubleAdvisor = () => {
    return <>
      <br /><br />
      <div style={{ width: "100%", display: "grid", gridTemplateColumns: "auto auto", gap: "5pt" }}>
        <div>
          <b>Pembimbing Pertama</b>

          <br />
          <br />
          <br />
          <br />
          <br />
          <br />

          <span style={{
            fontWeight: "bold", textDecoration: "underline",
            textUnderlineOffset: "2pt",
          }}>
            {name(
              profile?.advisorName ||
              ""
            )}
          </span><br />
          <span
            style={{
              fontWeight: "bold",
              paddingTop: "1px",
              display: "inline-block",
            }}
          >
            NIP.{" "}
            {profile?.advisorNip ||
              ""}
          </span>

        </div>
        <div>
          <b>Pembimbing Kedua</b>

          <br />
          <br />
          <br />
          <br />
          <br />
          <br />

          <span style={{
            fontWeight: "bold", textDecoration: "underline",
            textUnderlineOffset: "2pt",
          }}>
            {name(
              profile?.secondAdvisor?.name ||
              ".",
            )}
          </span><br />
          <span
            style={{
              fontWeight: "bold",
              paddingTop: "1px",
              display: "inline-block",
            }}
          >
            NIP.{" "}
            {profile?.secondAdvisor?.nip ||
              ""}
          </span>

        </div>

      </div>
      <br />
      <br />
      <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
        <div>
          <b>Ketua Program Studi</b>

          <br />
          <br />
          <br />
          <br />
          <br />
          <br />

          <span style={{
            fontWeight: "bold", textDecoration: "underline",
            textUnderlineOffset: "2pt",
          }}>
            {name(
              document.getDocument().config.kaprodi?.name ||
              "Angraini, S.Kom., M.Eng., Ph.D.",
            )}
          </span><br />
          <span
            style={{
              fontWeight: "bold",
              paddingTop: "1px",
              display: "inline-block",
            }}
          >
            NIP.{" "}
            {document.getDocument().config.kaprodi?.nip ||
              "198408212009012008"}
          </span>

        </div>
      </div>
    </>
  }

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
              textDecoration: "underline",
              textUnderlineOffset: "2pt",
            }}
          >
            {profile?.name}
          </div>
          <div style={{ height: "5pt", width: "100%" }} />
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
        {profile?.secondAdvisor ? <DoubleAdvisor /> : <SingleAdvisor />}


      </div>
    </section>
  );
};
