import React from "react";
import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";

interface StatementPageProps {
  profile?: DocumentProfile;
  config?: HighTexConfig;
  underlineStyle?: boolean;
}

export const Statement: React.FC<StatementPageProps> = ({
  config,
  underlineStyle = true,
}) => {
  const { profile } = usePrintable();
  if (!profile) return null;

  return (
    <section className="introduction page-break">
      <h1 className="chapter" id="statement">
        LEMBAR PERNYATAAN
      </h1>

      <p className="paragraph" style={{ lineHeight: 1.5 }}>
        Dengan ini saya menyatakan bahwa dalam Tugas Akhir ini tidak terdapat
        karya yang pernah diajukan untuk memperoleh gelar kesarjanaan di suatu
        Perguruan Tinggi, dan sepanjang pengetahuan saya juga tidak terdapat
        karya atau pendapat yang pernah ditulis atau diterbitkan oleh orang lain
        kecuali yang secara tertulis diacu dalam naskah ini dan disebutkan di
        dalam daftar pustaka.
      </p>

      <table
        style={{ width: "100%", borderCollapse: "collapse", marginTop: "1cm" }}
      >
        <tbody>
          <tr>
            <td style={{ width: "5cm" }}></td>
            <td style={{ textAlign: "right" }}>
              Pekanbaru, {formatDate(config?.statementDate!)}
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
              <h4
                style={{
                  marginBottom: "1px",
                  textDecoration: underlineStyle ? "underline" : "none",
                }}
              >
                {profile.name}
              </h4>
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
                NIM. {profile.nim}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};
