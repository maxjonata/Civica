import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentPort, Enrollment } from "../ports/pilot";
export class GovbrDocument implements DocumentPort {
  constructor(private readonly origin: string) {}
  async create(enrollment: Enrollment, nickname: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle("Civica - vinculacao de conta");
    pdf.setSubject("Vinculacao " + enrollment.id);
    pdf.setCreator("Civica - piloto de conta e identidade");
    pdf.setProducer("pdf-lib");
    pdf.setCreationDate(new Date(enrollment.issuedAt));
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);
    const page = pdf.addPage([595.28, 841.89]);
    let y = 787;
    page.drawText("CIVICA", {
      x: 48,
      y,
      size: 12,
      font: bold,
      color: rgb(0.08, 0.37, 0.39),
    });
    y -= 34;
    page.drawText("Vinculacao de conta do piloto", {
      x: 48,
      y,
      size: 20,
      font: bold,
    });
    y -= 34;
    const paragraph = (text: string, size = 10, code = false) => {
      const chosen = code ? mono : font;
      const words = text.split(/\s+/);
      let line = "";
      for (const word of words) {
        const next = line ? line + " " + word : word;
        if (chosen.widthOfTextAtSize(next, size) > 497 && line) {
          page.drawText(line, { x: 48, y, size, font: chosen });
          y -= 16;
          line = word;
        } else line = next;
      }
      if (line) {
        page.drawText(line, { x: 48, y, size, font: chosen });
        y -= 16;
      }
      y -= 12;
    };
    paragraph(
      "Finalidade exclusiva: solicitar a vinculacao desta conta do piloto Civica ao signatario deste documento. Esta solicitacao nao constitui voto, procuracao, cessao de direitos ou autorizacao generica."
    );
    paragraph("Site: " + this.origin);
    paragraph(
      "Apelido da conta: " + nickname.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?")
    );
    paragraph("Conta opaca: " + enrollment.accountId, 9, true);
    paragraph("Documento: " + enrollment.id, 9, true);
    paragraph(
      "Resumo SHA-256 da chave publica: " + enrollment.keyDigest,
      8,
      true
    );
    paragraph("Desafio exclusivo: " + enrollment.nonce, 9, true);
    paragraph("Emitido em UTC: " + new Date(enrollment.issuedAt).toISOString());
    paragraph(
      "Valido ate UTC: " + new Date(enrollment.expiresAt).toISOString()
    );
    paragraph(
      "Confira a conta, o site, o desafio e a validade antes de assinar. Assine exclusivamente no portal oficial assinador.iti.br usando sua conta gov.br prata ou ouro. Nunca informe sua senha gov.br ao Civica. Envie o PDF digital original assinado, nao foto ou impressao."
    );
    paragraph(
      "A conferência sera manual. Assinatura valida nao significa reconhecimento facial neste site, login integrado gov.br, voto secreto ou garantia automatica de uma pessoa por CPF. A vinculacao e os dados de identidade nao serao publicados."
    );
    page.drawLine({
      start: { x: 48, y: 140 },
      end: { x: 545, y: 140 },
      color: rgb(0.75, 0.78, 0.78),
      thickness: 1,
    });
    page.drawText("Espaco livre para a assinatura eletrônica oficial.", {
      x: 48,
      y: 118,
      size: 10,
      font,
    });
    return pdf.save({ useObjectStreams: false });
  }
}
