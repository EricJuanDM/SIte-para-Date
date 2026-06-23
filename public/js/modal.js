/**
 * DatePerfeito - Sistema de Modais Customizados
 * Substitui os alert() e confirm() nativos por modais modernos baseados em Promises.
 */

export function showModal({ type = "alert", message = "" }) {
    return new Promise((resolve) => {
        // Obter ou criar o overlay do modal
        let overlay = document.getElementById("custom-modal-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "custom-modal-overlay";
            overlay.className = "modal-overlay";
            document.body.appendChild(overlay);
        }

        const isConfirm = type === "confirm";
        
        // Injetar HTML do modal
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>Aviso 🌸</h3>
                <p>${message}</p>
                <div class="modal-buttons">
                    ${isConfirm ? `<button class="btn-secondary" id="modal-btn-cancel">Cancelar</button>` : ""}
                    <button class="btn-primary" id="modal-btn-ok">OK</button>
                </div>
            </div>
        `;

        // Ativar animação de entrada no próximo ciclo de renderização
        requestAnimationFrame(() => {
            overlay.classList.add("active");
        });

        // Fechamento e resolução do modal
        const handleClose = (result) => {
            overlay.classList.remove("active");
            
            // Aguardar a transição de fade-out acabar antes de limpar o HTML
            setTimeout(() => {
                overlay.innerHTML = "";
                resolve(result);
            }, 300);
        };

        // Escutadores de eventos
        const btnOk = overlay.querySelector("#modal-btn-ok");
        btnOk.addEventListener("click", () => handleClose(true));

        if (isConfirm) {
            const btnCancel = overlay.querySelector("#modal-btn-cancel");
            btnCancel.addEventListener("click", () => handleClose(false));
        }
    });
}

// Exportar globalmente para scripts inline ou scripts não modulares
window.showModal = showModal;
