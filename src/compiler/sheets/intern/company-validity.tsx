import { usePrintable } from "@/hooks/use-printable";
import { formatDate } from "@/utils/date";
import { ParsedItalic } from "@/utils/parse-italic";
export const CompanyConsent = () => {
    const { document, profile } = usePrintable();
    if (!document) return null;
    return <section className="introduction page-break new-page">
        <h1 className="chapter" id="company-consent" style={{ textTransform: "uppercase" }}>Lembar Pengesahan Instansi</h1>
        <h1 className="chapter">
            <ParsedItalic text={document.getDocument().title} />
        </h1>

        <div
            style={{
                marginTop: "1.5cm",
                textAlign: "center",
            }}
        >
            <h1 className="chapter">LAPORAN KERJA PRAKTEK</h1>

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
                Telah diperiksa dan disetujui sebagai Laporan Kerja Praktek
                <br />
                di {document.getDocument().config.intern?.onsite_at ?? "{lokasi kerja praktek}"}, pada tanggal{" "}
                {formatDate(document.getDocument().config.intern?.validity ?? document.getDocument().config.consentDate ?? new Date)}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        paddingTop: "5em",
                        textAlign: "center",
                    }}
                >
                    <b>Pembimbing Instansi</b>

                    <br />
                    <br />
                    <br />
                    <br />
                    <br />
                    <br />

                    <span style={{ fontWeight: "bold" }}>
                        {document.getDocument().config.intern?.advisor?.name ?? profile?.advisorName}
                    </span>

                    <br />

                    <span
                        style={{
                            fontWeight: "bold",
                            paddingTop: "1px",
                            display: "inline-block",
                        }}
                    >
                        NIP. {document.getDocument().config.intern?.advisor?.nip ?? "198408212009012008"}
                    </span>
                </div>
            </div>
        </div>
    </section >
}