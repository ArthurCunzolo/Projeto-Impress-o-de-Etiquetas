// ===== State =====
let remetente = null;
let destinatarios = [];

// ===== Tabs =====
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document
      .getElementById("content-" + tab.dataset.tab)
      .classList.add("active");
  });
});

// ===== CEP Mask =====
["rem-cep", "dest-cep"].forEach((id) => {
  document.getElementById(id).addEventListener("input", function (e) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5, 8);
    e.target.value = v;
    if (v.replace("-", "").length === 8) {
      buscarCEP(id.startsWith("rem") ? "rem" : "dest");
    }
  });
});

// ===== UF to uppercase =====
["rem-uf", "dest-uf"].forEach((id) => {
  document.getElementById(id).addEventListener("input", function (e) {
    e.target.value = e.target.value.toUpperCase();
  });
});

// ===== CEP Lookup (ViaCEP) =====
async function buscarCEP(prefix) {
  const cepInput = document.getElementById(prefix + "-cep");
  const cep = cepInput.value.replace(/\D/g, "");
  if (cep.length !== 8) {
    cepInput.classList.add("error");
    setTimeout(() => cepInput.classList.remove("error"), 1500);
    return;
  }
  try {
    cepInput.parentElement.classList.add("loading");
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) {
      cepInput.classList.add("error");
      setTimeout(() => cepInput.classList.remove("error"), 1500);
      return;
    }
    document.getElementById(prefix + "-logradouro").value =
      data.logradouro || "";
    document.getElementById(prefix + "-bairro").value = data.bairro || "";
    document.getElementById(prefix + "-cidade").value = data.localidade || "";
    document.getElementById(prefix + "-uf").value = data.uf || "";
  } catch (e) {
    console.error("Erro ao buscar CEP:", e);
  } finally {
    cepInput.parentElement.classList.remove("loading");
  }
}

// ===== Get Form Data =====
function getFormData(prefix) {
  const fields = [
    "nome",
    "cep",
    "uf",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
  ];
  const data = {};
  let valid = true;
  fields.forEach((f) => {
    const el = document.getElementById(prefix + "-" + f);
    data[f] = el.value.trim();
    if (f !== "complemento" && !data[f]) {
      el.classList.add("error");
      setTimeout(() => el.classList.remove("error"), 2000);
      valid = false;
    }
  });
  return valid ? data : null;
}

// ===== Save Remetente =====
function salvarRemetente() {
  const data = getFormData("rem");
  if (!data) return;
  remetente = data;
  localStorage.setItem("envelope_remetente", JSON.stringify(remetente));
  const msg = document.getElementById("remetente-saved-msg");
  msg.style.display = "block";
  setTimeout(() => (msg.style.display = "none"), 3000);
  updateGenerateButton();
}

// ===== Add Destinatário =====
function adicionarDestinatario() {
  const data = getFormData("dest");
  if (!data) return;
  destinatarios.push(data);
  renderDestinatarios();
  clearForm("dest");
  updateGenerateButton();
  // Focus back on nome
  document.getElementById("dest-nome").focus();
}

// ===== Clear Form =====
function clearForm(prefix) {
  [
    "nome",
    "cep",
    "uf",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
  ].forEach((f) => {
    document.getElementById(prefix + "-" + f).value = "";
  });
}

// ===== Render Destinatários List =====
function renderDestinatarios() {
  const container = document.getElementById("lista-destinatarios");
  const card = document.getElementById("lista-destinatarios-card");
  const badge = document.getElementById("badge-count");
  const countText = document.getElementById("dest-count-text");

  if (destinatarios.length === 0) {
    card.style.display = "none";
    badge.style.display = "none";
    return;
  }

  card.style.display = "block";
  badge.style.display = "inline";
  badge.textContent = destinatarios.length;
  countText.textContent =
    destinatarios.length +
    " destinatário" +
    (destinatarios.length > 1 ? "s" : "") +
    " adicionado" +
    (destinatarios.length > 1 ? "s" : "");

  container.innerHTML = destinatarios
    .map(
      (d, i) => `
        <div class="dest-item">
            <div class="dest-info">
                <div class="dest-name">${escapeHtml(d.nome)}</div>
                <div class="dest-address">
                    ${escapeHtml(d.logradouro)}, nº ${escapeHtml(d.numero)}${d.complemento ? " - " + escapeHtml(d.complemento) : ""}<br>
                    ${escapeHtml(d.bairro)} - ${escapeHtml(d.cidade)}/${escapeHtml(d.uf)} - CEP: ${escapeHtml(d.cep)}
                </div>
            </div>
            <button class="btn-remove" onclick="removerDestinatario(${i})">✕ Remover</button>
        </div>
    `,
    )
    .join("");
}

// ===== Remove Destinatário =====
function removerDestinatario(index) {
  destinatarios.splice(index, 1);
  renderDestinatarios();
  updateGenerateButton();
}

// ===== Update Generate Button Visibility =====
function updateGenerateButton() {
  const area = document.getElementById("generate-area");
  area.style.display = destinatarios.length > 0 ? "block" : "none";
}

// ===== Escape HTML =====
function escapeHtml(str) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

// ===== Generate Barcode as Data URL =====
function generateBarcodeDataURL(cepValue) {
  const cepClean = cepValue.replace(/\D/g, "");
  const canvas = document.getElementById("barcode-canvas");
  try {
    JsBarcode(canvas, cepClean, {
      format: "CODE128",
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 5,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("Barcode generation error:", e);
    return null;
  }
}

// ===== Draw Postal Stamp (Selo Correios) =====
function drawPostalStamp(pdf, centerX, centerY, radius) {
  // Outer circle
  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.8);
  pdf.circle(centerX, centerY, radius);

  // Inner circle (smaller, decorative)
  pdf.setLineWidth(0.3);
  pdf.circle(centerX, centerY, radius - 1.5);

  // "Carta" text - large centered
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 30, 30);
  pdf.text("Carta", centerX, centerY - 3, { align: "center" });

  // Authorization number
  pdf.setFontSize(5);
  pdf.setFont("helvetica", "normal");
  pdf.text("9912595290 / 2023 / DR-SPI", centerX, centerY + 2, {
    align: "center",
  });

  // Location
  pdf.setFontSize(5);
  pdf.text("ENTRE RIOS COUNTRY", centerX, centerY + 5, { align: "center" });

  // Correios brand
  pdf.setFontSize(6);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 204, 0); // Yellow
  pdf.text("Correios", centerX, centerY + 9, { align: "center" });

  // Reset text color
  pdf.setTextColor(0, 0, 0);
}

// ===== Helper: download PDF blob =====
function downloadPDF(pdf, filename) {
  const pdfBlob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.type = "application/pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.open(blobUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

// ===== Generate PDF: REMETENTE =====
function gerarPDFRemetente() {
  if (!remetente) {
    alert("Preencha e salve os dados do remetente primeiro.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const pageW = 220;
    const pageH = 110;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [pageH, pageW],
    });

    // Remetente box - bottom-left (same position as destinatário for print alignment)
    const boxW = 130;
    const boxH = 38;
    const boxX = 8;
    const boxY = pageH - boxH - 22;

    // Border rectangle
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.3);
    pdf.rect(boxX, boxY, boxW, boxH);

    // "Remetente" label
    pdf.setFontSize(7);
    pdf.setTextColor(0, 100, 200);
    pdf.text("Remetente", boxX + 3, boxY + 5);

    // Remetente data
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);

    let y = boxY + 12;
    const lineH = 4.5;

    pdf.setFont("helvetica", "bold");
    pdf.text(remetente.nome, boxX + 3, y);
    y += lineH;

    pdf.setFont("helvetica", "normal");
    let addrLine = remetente.logradouro + "  n\u00ba " + remetente.numero;
    if (remetente.complemento) addrLine += "  -  " + remetente.complemento;
    pdf.text(addrLine, boxX + 3, y);
    y += lineH;

    pdf.text(
      "Bairro: " + remetente.bairro + "   Cidade: " + remetente.cidade,
      boxX + 3,
      y,
    );
    y += lineH;

    pdf.text("CEP: " + remetente.cep, boxX + 3, y);

    // Barcode below box
    //const barcode = generateBarcodeDataURL(remetente.cep);
    //if (barcode) {
      //pdf.addImage(barcode, "PNG", boxX + 30, boxY + boxH + 2, 45, 16);
    //}

    downloadPDF(pdf, "remetente_envelope.pdf");
  } catch (err) {
    console.error("Erro ao gerar PDF do remetente:", err);
    alert("Erro ao gerar PDF: " + err.message);
  }
}

// ===== Generate PDF: DESTINATÁRIOS =====
function gerarPDFDestinatarios() {
  if (destinatarios.length === 0) {
    alert("Adicione pelo menos um destinat\u00e1rio.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const pageW = 220;
    const pageH = 110;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [pageH, pageW],
    });

    destinatarios.forEach((dest, idx) => {
      if (idx > 0) pdf.addPage([pageH, pageW], "landscape");

      // Same box dimensions and position as remetente
      const boxX = 8;
      const boxW = 130;
      const boxH = 38;
      const boxY = pageH - boxH - 22;

      // ===== POSTAL STAMP (centered on page, above the box) =====
      const stampRadius = 13;
      const stampCX = pageW / 1.4;
      const stampCY = boxY / 1;
      drawPostalStamp(pdf, stampCX, stampCY, stampRadius);

      // ===== DESTINATÁRIO box (same layout as remetente) =====
      // Border rectangle
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.rect(boxX, boxY, boxW, boxH);

      // "Destinatário" label
      pdf.setFontSize(7);
      pdf.setTextColor(0, 100, 200);
      pdf.text("Destinat\u00e1rio", boxX + 3, boxY + 5);

      // Dest data - same format as remetente
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);

      let y = boxY + 12;
      const lineH = 4.5;

      pdf.setFont("helvetica", "bold");
      pdf.text(dest.nome, boxX + 3, y);
      y += lineH;

      pdf.setFont("helvetica", "normal");
      let addrLine = dest.logradouro + "  n\u00ba " + dest.numero;
      if (dest.complemento) addrLine += "  -  " + dest.complemento;
      pdf.text(addrLine, boxX + 3, y);
      y += lineH;

      pdf.text(
        "Bairro: " + dest.bairro + "   Cidade: " + dest.cidade,
        boxX + 3,
        y,
      );
      y += lineH;

      pdf.text("CEP: " + dest.cep, boxX + 3, y);

      // Barcode below box - same position as remetente
      //const barcode = generateBarcodeDataURL(dest.cep);
      //if (barcode) {
        //pdf.addImage(barcode, "PNG", boxX + 30, boxY + boxH + 2, 45, 16);
      //}
    });

    downloadPDF(pdf, "destinatarios_envelope.pdf");
  } catch (err) {
    console.error("Erro ao gerar PDF dos destinat\u00e1rios:", err);
    alert("Erro ao gerar PDF: " + err.message);
  }
}

// ===== Load saved remetente from localStorage =====
(function loadSaved() {
  const saved = localStorage.getItem("envelope_remetente");
  if (saved) {
    try {
      remetente = JSON.parse(saved);
      [
        "nome",
        "cep",
        "uf",
        "logradouro",
        "numero",
        "complemento",
        "bairro",
        "cidade",
      ].forEach((f) => {
        document.getElementById("rem-" + f).value = remetente[f] || "";
      });
    } catch (e) {
      /* ignore */
    }
  }
})();
