import { ParsedItalic } from "@/utils/parse-italic";
import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";
import { name } from "@/utils/name";
import React from "react";

export const Validity = () => {
  const { document, profile } = usePrintable();
  const doc = document?.getDocument();
  if (!doc) return null;

  const members: { role: string; name: string }[] = [
    {
      name: doc.config.leader || "",
      role: "Ketua",
    },
    {
      name: profile?.advisorName || "",
      role: "Sekretaris",
    },
    ...(profile?.secondAdvisor
      ? [
        {
          name: profile.secondAdvisor.name,
          role: "Anggota 1",
        },
      ]
      : []),
    {
      name: doc.config.member_1 || "",
      role: profile?.secondAdvisor ? "Anggota 2" : "Anggota 1",
    },
    {
      name: doc.config.member_2 || "",
      role: profile?.secondAdvisor ? "Anggota 3" : "Anggota 2",
    },
  ];

  return (
    <section className="introduction page-break new-page">
      <h1 className="chapter" id="validity">
        LEMBAR PENGESAHAN
      </h1>

      <h1 className="chapter">
        <ParsedItalic text={doc.title} />
      </h1>

      <h2
        style={{
          textAlign: "center",
          fontSize: "14pt",
        }}
      >
        TUGAS AKHIR
      </h2>

      <div
        style={{
          fontSize: "13.5pt",
          marginBottom: "1em",
          lineHeight: "16.2pt",
          marginTop: "1em",
          textAlign: "center",
        }}
      >
        Oleh:
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

      <div>
        <p
          style={{
            textAlign: "center",
            lineHeight: "1.5em",
          }}
        >
          Telah dipertahankan di depan sidang dewan penguji
          <br />
          sebagai salah satu syarat untuk memperoleh gelar Sarjana Komputer
          <br />
          Fakultas Sains dan Teknologi Universitas Islam Negeri Sultan Syarif
          Kasim Riau
          <br />
          di Pekanbaru, pada tanggal {formatDate(doc.config.validityDate!)}
        </p>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "20px",
        }}
      >
        <tbody>
          <tr>
            <td>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <br />
                  <div style={{ fontWeight: "bold", marginTop: "15pt" }}>
                    Dekan
                  </div>
                  <div className="spacer" style={{ height: "70pt" }}></div>
                  <div>
                    {" "}
                    <span
                      style={{
                        textDecoration: "underline",
                        textUnderlineOffset: "2pt",
                        fontWeight: "bold",
                      }}
                    >
                      {name("Dr. Yuslenita Muda, S.Si., M.Sc.")}
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span
                      style={{
                        fontWeight: "bold",
                        paddingTop: "1px",
                        display: "inline-block",
                      }}
                    >
                      NIP. 197701032007102001
                    </span>
                  </div>
                </div>

                <div>
                  <div>
                    Pekanbaru, 9 September 2026
                    <br />
                    Mengesahkan
                  </div>
                  <div style={{ fontWeight: "bold", marginTop: "10pt" }}>
                    Ketua Program Studi
                  </div>
                  <div className="spacer" style={{ height: "70pt" }}></div>

                  <div style={{ fontWeight: "bold" }}>
                    {" "}
                    <span
                      style={{
                        textDecoration: "underline",
                        textUnderlineOffset: "2pt",
                      }}
                    >
                      {name("Angraini, S.Kom., M.Eng., Ph.D.")}
                    </span>
                  </div>
                  <div>
                    {" "}
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
                </div>
              </div>
              <br />
              <br />

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  <tr>
                    <td colSpan={5} style={{ fontWeight: "bold" }}>
                      DEWAN PENGUJI :
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={5} style={{ height: "30px" }}></td>
                  </tr>

                  {members.map((member, index) => {
                    const isLeftSignature = index % 2 === 0;

                    return (
                      <React.Fragment key={`${member.role}-${index}`}>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>
                            {member.role}
                          </td>

                          <td
                            style={{
                              fontWeight: "bold",
                              paddingRight: "2px",
                            }}
                          >
                            :
                          </td>

                          <td
                            style={{
                              fontWeight: "bold",
                              width: "min-content",
                            }}
                          >
                            {member.name ? name(member.name) : ""}
                          </td>

                          <td
                            style={
                              isLeftSignature
                                ? {
                                  borderBottom: "1px solid #000",
                                  width: "70px",
                                }
                                : undefined
                            }
                          >
                            <p></p>
                          </td>

                          <td
                            style={
                              !isLeftSignature
                                ? {
                                  borderBottom: "1px solid #000",
                                  width: "70px",
                                }
                                : undefined
                            }
                          >
                            <p></p>
                          </td>
                        </tr>

                        {index < members.length - 1 && (
                          <tr>
                            <td colSpan={5} style={{ height: "30px" }}></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};
