import { ParsedItalic } from "@/utils/parse-italic";
import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";

export const Validity = () => {
  const { document, profile } = usePrintable();
  const doc = document?.getDocument();
  if (!doc) return null;

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
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  <tr>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "left" }}>
                      Pekanbaru, {formatDate(doc.config.validityDate!)}
                    </td>
                  </tr>

                  <tr>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "left" }}>Mengesahkan,</td>
                  </tr>

                  <tr>
                    <td style={{ height: "20px" }}></td>
                    <td></td>
                    <td></td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "bold" }}>Dekan</td>

                    <td></td>

                    <td
                      style={{
                        fontWeight: "bold",
                        textAlign: "left",
                      }}
                    >
                      Ketua Program Studi
                    </td>
                  </tr>

                  <tr>
                    <td style={{ height: "80px" }}></td>
                    <td style={{ width: "80px" }}></td>
                    <td></td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "bold" }}>
                      Dr. Yuslenita Muda, S.Si., M.Sc.
                    </td>

                    <td></td>

                    <td
                      style={{
                        fontWeight: "bold",
                        textAlign: "left",
                      }}
                    >
                      Angraini, S.Kom., M.Eng., Ph.D.
                    </td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "bold" }}>
                      <span
                        style={{
                          fontWeight: "bold",
                          paddingTop: "1px",
                          display: "inline-block",
                        }}
                      >
                        NIP. 197701032007102001
                      </span>
                    </td>

                    <td></td>

                    <td
                      style={{
                        fontWeight: "bold",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "bold",
                          paddingTop: "1px",
                          display: "inline-block",
                        }}
                      >
                        NIP. 198408212009012008
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

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

                  <tr>
                    <td style={{ fontWeight: "bold" }}>Ketua</td>

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
                      {doc.config.leader!}
                    </td>

                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        width: "70px",
                      }}
                    >
                      <p></p>
                    </td>

                    <td>
                      <p> </p>
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={5} style={{ height: "30px" }}></td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "bold" }}>Sekretaris</td>

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
                      {profile?.advisorName}
                    </td>

                    <td></td>

                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        width: "70px",
                      }}
                    >
                      <p></p>
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={5} style={{ height: "30px" }}></td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "bold" }}>Anggota 1</td>

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
                      {doc.config.member_1!}
                    </td>

                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        width: "70px",
                      }}
                    >
                      <p></p>
                    </td>

                    <td></td>
                  </tr>

                  <tr>
                    <td colSpan={5} style={{ height: "30px" }}></td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "bold" }}>Anggota 2</td>

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
                      {doc.config.member_2!}
                    </td>

                    <td></td>

                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        width: "70px",
                      }}
                    >
                      <p></p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};
