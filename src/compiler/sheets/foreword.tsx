import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";

export const Foreword = () => {
  const { document, profile } = usePrintable();
  if (!document) return null;

  return (
    <section className="introduction new-page page-break">
      <h1 className="pra-title chapter" id="foreword">
        KATA PENGANTAR
      </h1>

      <div style={{ lineHeight: "1.5" }} className="foreword"></div>

      <table style={{ width: "100%", marginTop: "1cm" }}>
        <tbody>
          <tr>
            <td style={{ width: "5cm" }}></td>
            <td style={{ textAlign: "right" }}>
              Pekanbaru,{" "}
              {formatDate(document.getDocument().config.statementDate)}
            </td>
          </tr>
          <tr>
            <td></td>
            <td style={{ textAlign: "right" }}>Yang Membuat Pernyataan,</td>
          </tr>
          <tr>
            <td style={{ height: "0.5cm" }}></td>
            <td style={{ height: "0.5cm" }}></td>
          </tr>
          <tr>
            <td style={{ height: "2cm" }}></td>
            <td style={{ height: "2cm" }}></td>
          </tr>
          <tr>
            <td></td>
            <td
              style={{
                fontWeight: "bold",
                textAlign: "right",
                textTransform: "uppercase",
              }}
            >
              <h4 style={{ marginBottom: "1px" }}>{profile?.name}</h4>
            </td>
          </tr>
          <tr>
            <td></td>
            <td style={{ fontWeight: "bold", textAlign: "right" }}>
              <span
                style={{
                  fontWeight: "bold",
                  paddingTop: "1px",
                  display: "inline-block",
                }}
              >
                NIM.
                {profile?.nim}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};
