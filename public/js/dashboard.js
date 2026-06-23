import { auth, db, storage } from "./firebase-config.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { showModal } from "./modal.js";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

const recusaList = document.getElementById("recusaList");
const btnAddRecusa = document.getElementById("btnAddRecusa");
const inviteForm = document.getElementById("inviteForm");

let recusaCount = 0;
let unsubscribe = null;

// Adicionar um novo campo de opção de recusa
async function addRecusaField(value = "") {
    const currentFields = recusaList.children.length;
    if (currentFields >= 5) {
        await showModal({ type: "alert", message: "O limite máximo é de 5 opções de recusa! ⛔" });
        return;
    }
    
    recusaCount++;
    const div = document.createElement("div");
    div.className = "recusa-item";
    div.id = `recusa-item-${recusaCount}`;
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Opção ${currentFields + 1}`;
    input.value = value;
    input.required = true;
    input.maxLength = 50;
    
    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn-remove-recusa";
    btnRemove.innerHTML = "🗑️";
    btnRemove.onclick = async () => {
        if (recusaList.children.length <= 2) {
            await showModal({ type: "alert", message: "Você precisa definir pelo menos 2 opções de recusa! ⛔" });
            return;
        }
        div.remove();
        updatePlaceholders();
    };
    
    div.appendChild(input);
    div.appendChild(btnRemove);
    recusaList.appendChild(div);
    updatePlaceholders();
}

function updatePlaceholders() {
    Array.from(recusaList.children).forEach((child, index) => {
        const input = child.querySelector("input");
        if (input) input.placeholder = `Opção ${index + 1}`;
    });
}

// Configurar as opções de recusa iniciais padrão no formulário
addRecusaField("não...");
addRecusaField("tem certeza? 🤔");

if (btnAddRecusa) {
    btnAddRecusa.addEventListener("click", () => addRecusaField(""));
}

// Lógica de monitoramento em tempo real dos convites criados
function setupRealtimeListener(userId) {
    const q = query(
        collection(db, "convites"), 
        where("remetenteId", "==", userId),
        orderBy("criadoEm", "desc")
    );
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        const listDiv = document.getElementById("invitationsList");
        if (snapshot.empty) {
            listDiv.innerHTML = `
                <p style="color: var(--color-text-light); text-align: center; margin-top: 40px; font-size: 13px;">
                    Você ainda não enviou nenhum convite. Crie um ao lado! 🌸
                </p>
            `;
            return;
        }
        
        listDiv.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Determinar o status
            let statusText = "Pendente";
            let statusClass = "pendente";
            
            if (data.status === "aceito") {
                statusText = "Aceito";
                statusClass = "aceito";
            }
            
            if (data.horarioEscolhido) {
                statusText = "Horário Marcado";
                statusClass = "marcado";
            }
            
            // Renderizar detalhes de resposta
            let detailsHtml = "";
            if (data.horarioEscolhido) {
                detailsHtml = `
                    <div class="invitation-details">
                        💖 <strong>${data.nomeDestinatario}</strong> marcou com você!<br>
                        📅 <strong>Quando:</strong> ${data.horarioEscolhido}<br>
                        🍔 <strong>Comida:</strong> ${data.alimentoEscolhido || "A definir"}
                    </div>
                `;
            } else {
                detailsHtml = `
                    <div class="invitation-details">
                        Aguardando resposta de <strong>${data.nomeDestinatario}</strong>... ⏳
                    </div>
                `;
            }
            
            const card = document.createElement("div");
            card.className = `invitation-card status-${statusClass}`;
            card.innerHTML = `
                <div class="invitation-card-header">
                    <h4>Para: ${data.nomeDestinatario}</h4>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                ${detailsHtml}
                <div class="invitation-actions">
                    <button class="btn-copy" onclick="copyInviteLink('${id}', this)">Copiar Link 🔗</button>
                    <button class="btn-delete" onclick="deleteInvite('${id}')">Excluir 🗑️</button>
                </div>
            `;
            listDiv.appendChild(card);
        });
    }, (error) => {
        console.error("Erro no listener do Firestore:", error);
        document.getElementById("invitationsList").innerHTML = `
            <p style="color: #cc0000; text-align: center; margin-top: 40px; font-size: 13px;">
                Erro ao carregar convites. Verifique suas permissões do Firestore.
            </p>
        `;
    });
}

// Funções globais expostas no escopo window
window.copyInviteLink = function(id, button) {
    const inviteUrl = `${window.location.origin}/convite/${id}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = "✓ Copiado!";
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error("Erro ao copiar link:", err);
        // Fallback
        const temp = document.createElement("input");
        temp.value = inviteUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        
        const originalText = button.innerHTML;
        button.innerHTML = "✓ Copiado!";
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    });
};

window.deleteInvite = async function(id) {
    const confirmDelete = await showModal({
        type: "confirm",
        message: "Tem certeza que deseja excluir permanentemente este convite? 💔"
    });
    if (confirmDelete) {
        try {
            await deleteDoc(doc(db, "convites", id));
        } catch (err) {
            console.error("Erro ao deletar convite:", err);
            await showModal({ type: "alert", message: "Não foi possível excluir o convite." });
        }
    }
};

// Envio do formulário de criação de convites
if (inviteForm) {
    inviteForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nomeDestinatario = document.getElementById("nomeDestinatario").value.trim();
        const mensagemPersonalizada = document.getElementById("mensagemPersonalizada").value.trim();
        const corFundo = document.getElementById("corFundo").value;
        const corCard = document.getElementById("corCard").value;
        
        const opcoesRecusa = [];
        Array.from(recusaList.children).forEach(child => {
            const input = child.querySelector("input");
            if (input && input.value.trim() !== "") {
                opcoesRecusa.push(input.value.trim());
            }
        });

        if (opcoesRecusa.length < 2) {
            await showModal({ type: "alert", message: "Você precisa fornecer pelo menos 2 opções de recusa! ⛔" });
            return;
        }

        const btnSubmit = document.getElementById("btnSubmitInvite");
        const originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Usuário não autenticado.");

            // 1. Criar convite no Firestore
            const docRef = await addDoc(collection(db, "convites"), {
                remetenteId: user.uid,
                nomeDestinatario: nomeDestinatario,
                status: "pendente",
                horarioEscolhido: "",
                alimentoEscolhido: "",
                criadoEm: serverTimestamp(),
                aceitoEm: null,
                personalizacao: {
                    corFundo: corFundo,
                    corCard: corCard,
                    imagens: ["", "", ""], // URLs vazias inicialmente
                    opcoesRecusa: opcoesRecusa,
                    mensagemPersonalizada: mensagemPersonalizada
                }
            });

            const conviteId = docRef.id;
            const imagensUrls = ["", "", ""];

            // 2. Upload de imagens para o Storage, se selecionadas
            const inputIds = ["imgInput1", "imgInput2", "imgInput3"];
            for (let i = 0; i < inputIds.length; i++) {
                const input = document.getElementById(inputIds[i]);
                if (input.files && input.files[0]) {
                    const file = input.files[0];
                    btnSubmit.textContent = `Enviando Imagem ${i+1}...`;
                    
                    const ext = file.name.split('.').pop() || 'webp';
                    const fileRef = ref(storage, `convites/${conviteId}/imagem${i+1}.${ext}`);
                    
                    await uploadBytes(fileRef, file);
                    const downloadUrl = await getDownloadURL(fileRef);
                    imagensUrls[i] = downloadUrl;
                }
            }

            // 3. Atualizar o Firestore com as URLs finais das imagens
            await updateDoc(docRef, {
                "personalizacao.imagens": imagensUrls
            });

            // Exibir contêiner de link destacado com feedback de cópia
            const generatedLinkContainer = document.getElementById("generatedLinkContainer");
            const generatedLinkInput = document.getElementById("generatedLinkInput");
            const btnCopyGenerated = document.getElementById("btnCopyGenerated");

            const inviteUrl = `${window.location.origin}/convite/${conviteId}`;
            generatedLinkInput.value = inviteUrl;
            generatedLinkContainer.style.display = "block";
            generatedLinkContainer.scrollIntoView({ behavior: "smooth" });

            btnCopyGenerated.onclick = () => {
                navigator.clipboard.writeText(inviteUrl).then(() => {
                    btnCopyGenerated.textContent = "✓ Copiado!";
                    setTimeout(() => {
                        btnCopyGenerated.textContent = "Copiar Link";
                    }, 2000);
                }).catch(err => {
                    console.error("Erro ao copiar:", err);
                    generatedLinkInput.select();
                    document.execCommand("copy");
                    btnCopyGenerated.textContent = "✓ Copiado!";
                    setTimeout(() => {
                        btnCopyGenerated.textContent = "Copiar Link";
                    }, 2000);
                });
            };

            await showModal({ type: "alert", message: "Convite criado com sucesso! 🎉" });
            inviteForm.reset();
            
            // Resetar os campos de fotos
            for (let i = 1; i <= 3; i++) {
                document.getElementById(`imgPrev${i}`).style.display = 'none';
                document.getElementById(`imgPrev${i}`).src = '';
                document.getElementById(`imgIcon${i}`).style.display = 'block';
                document.getElementById(`imgText${i}`).style.display = 'block';
            }
            
            // Resetar a lista de opções de recusa
            recusaList.innerHTML = "";
            addRecusaField("não...");
            addRecusaField("tem certeza? 🤔");

        } catch (err) {
            console.error("Erro ao criar convite:", err);
            await showModal({ type: "alert", message: "Erro ao criar convite. Verifique as configurações de Storage/Firestore." });
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });
}

// Monitorar estado de autenticação
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    // Exibir o nome do usuário logado
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().nome) {
            document.getElementById("userName").textContent = userSnap.data().nome;
        } else {
            document.getElementById("userName").textContent = user.displayName || "Remetente";
        }
    } catch (e) {
        console.error("Erro ao obter dados do usuário:", e);
        document.getElementById("userName").textContent = user.displayName || "Remetente";
    }

    // Inicializar listener de dados
    setupRealtimeListener(user.uid);
});

// Botão Sair (Logout)
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).then(() => {
            if (unsubscribe) unsubscribe();
            window.location.href = "index.html";
        }).catch(err => {
            console.error("Erro ao fazer logout:", err);
        });
    });
}
